import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import { playerForElement, remapChunks } from "../lib/tts-lifecycle";
import { selectVoice } from "../lib/tts-selection";

// UI strings come from the theme translations (locales/*.yml), so the player
// speaks the platform's language: German forums get German controls, English
// forums English ones. `themePrefix` is injected into theme modules by
// Discourse (same as `settings`), so no import is needed.
const T = (key) => i18n(themePrefix(`tts_listen.${key}`));

const BLOCK_SELECTOR =
  "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, figcaption";

// Chrome silently cuts off long utterances (~200-250 chars / ~15s), so long
// blocks are split at sentence boundaries before being queued.
const MAX_UTTERANCE_LENGTH = 250;

// Only one post may speak at a time (speechSynthesis is global).
let activePlayer = null;

// Live players keyed by post id. Discourse removes posts from the DOM when
// they scroll out of view ("cloaking") and renders them again when they
// scroll back; this registry lets the player survive that re-render and keep
// speaking instead of being cut off mid-sentence.
const players = new Map();

function stopAllPlayers() {
  for (const player of [...players.values()]) {
    player.stop();
  }
  players.clear();
  // Also stops any unregistered player (created when the post model was
  // unavailable, so it has no stable key).
  window.speechSynthesis.cancel();
}

export default apiInitializer((api) => {
  const supported =
    "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  if (supported) {
    // Discourse is a single-page app: stop speaking on navigation.
    api.onPageChange(() => stopAllPlayers());

    // Workaround for a Chrome desktop bug that silently stops long playback.
    setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.speaking && !synth.paused) {
        synth.resume();
      }
    }, 10000);
  }

  api.decorateCookedElement(
    (cooked, helper) => {
      if (cooked.dataset.ttsProcessed === "1") {
        return;
      }
      cooked.dataset.ttsProcessed = "1";

      if (!supported) {
        if (settings.show_unsupported_notice) {
          const note = document.createElement("p");
          note.className = "tts-unsupported";
          note.textContent = T("unsupported");
          cooked.prepend(note);
        }
        return;
      }

      let post = null;
      try {
        post = helper?.model ?? helper?.getPost?.() ?? null;
      } catch {
        /* post model unavailable; player stays bound to this element */
      }
      const postNumber = post?.post_number ?? null;
      const postId = post?.id ?? null;

      // The same post may already have a live player: Discourse re-renders
      // posts as they scroll out of view and back, and that must not cut off
      // the voice. A still-speaking player is re-attached to this element;
      // otherwise a fresh one is created.
      const { player, reused } = playerForElement(
        players,
        postId,
        () => new TTSPlayer(cooked, postNumber, postId)
      );
      if (reused) {
        player.attach(cooked, postNumber);
      }

      // Runs when the post is re-rendered or removed from the stream. The
      // player is only detached, not stopped: a re-rendered post (scrolled
      // away and back) re-attaches it and the voice never breaks stride.
      // Speech ends via stop(), finishing the post, or navigating away.
      return () => player.detach();
    },
    { onlyStream: true }
  );
});

class TTSPlayer {
  constructor(cooked, postNumber, postId) {
    this.cooked = cooked;
    this.postId = postId; // null when the post model is unavailable
    this.synth = window.speechSynthesis;
    this.postNumber = postNumber;
    this.blocks = [];
    this.index = 0;
    this.state = "idle"; // idle | playing | paused | done
    this.gen = 0; // invalidates stale utterance callbacks after cancel/restart
    this.rate = Number(settings.default_rate) || 1;
    this.voice = null;
    this.voiceLang = "";
    this.voiceChosen = false; // the user picked their own voice in the dropdown
    this.currentBlock = null;

    this.applyDefaultSelection();
    this.buildUI();
    this.loadVoices();
    // addEventListener, not onvoiceschanged: each player assigning the global
    // property would overwrite every other player's handler. Safari never
    // fires this event, but there getVoices() works synchronously above.
    this.onVoicesChanged = () => this.loadVoices();
    this.synth.addEventListener?.("voiceschanged", this.onVoicesChanged);
  }

  buildUI() {
    const root = document.createElement("div");
    root.className = "tts-player";
    root.setAttribute("role", "group");
    root.setAttribute(
      "aria-label",
      this.postNumber
        ? `${T("group_label")} (post #${this.postNumber})`
        : T("group_label")
    );

    this.playBtn = this.makeButton(T("listen"), "tts-toggle", () =>
      this.toggle()
    );
    this.stopBtn = this.makeButton(T("stop"), "tts-stop", () => this.stop());
    this.stopBtn.disabled = true;
    root.append(this.playBtn, this.stopBtn);

    this.speedField = this.makeSelect(
      [0.75, 1, 1.25, 1.5, 2].map((r) => ({
        value: String(r),
        label: `${r}×`,
        selected: r === this.rate,
      })),
      T("speed"),
      (val) => {
        this.rate = parseFloat(val);
        if (this.state === "playing" || this.state === "paused") {
          this.state = "playing";
          this.speakCurrent(); // restart current block at the new speed
        }
      }
    );
    root.append(this.speedField.wrapper);

    if (settings.show_voice_selector) {
      this.voiceField = this.makeSelect([], T("voice"), (val) => {
        this.voiceChosen = true;
        const voices = this.synth.getVoices();
        this.voice = val === "" ? null : voices[Number(val)] || null;
        if (this.state === "playing" || this.state === "paused") {
          this.state = "playing";
          this.speakCurrent();
        }
      });
      root.append(this.voiceField.wrapper);
    }

    // Polite live region so screen-reader users get state changes.
    this.status = document.createElement("span");
    this.status.className = "tts-sr-only";
    this.status.setAttribute("aria-live", "polite");
    root.append(this.status);

    this.cooked.prepend(root);
    this.updateUI();
  }

  makeButton(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn btn-small ${cls}`;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  makeSelect(options, labelText, onChange) {
    const wrapper = document.createElement("label");
    wrapper.className = "tts-field";
    const span = document.createElement("span");
    span.className = "tts-field-label";
    span.textContent = labelText;
    const select = document.createElement("select");
    select.className = "tts-select";
    for (const { value, label, selected } of options) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      if (selected) {
        o.selected = true;
      }
      select.append(o);
    }
    select.addEventListener("change", () => onChange(select.value));
    wrapper.append(span, select);
    return { wrapper, select };
  }

  loadVoices() {
    // Chrome populates voices asynchronously (and iOS only after a user
    // gesture), so the configured default is re-applied whenever the device
    // reports them — including when the voice selector is hidden, which is
    // otherwise the only path that never re-runs this. A user's own choice
    // in the dropdown still wins (applyDefaultSelection bails out then).
    if (!this.voiceChosen) {
      this.applyDefaultSelection();
    }

    if (!this.voiceField) {
      return;
    }

    const voices = this.synth.getVoices();
    if (!voices.length) {
      return; // still waiting; voiceschanged will fire again
    }
    const select = this.voiceField.select;
    const prev = select.value;
    select.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = T("default_voice");
    select.append(def);
    voices.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${v.name} (${v.lang})`;
      select.append(o);
    });
    const idx = voices.indexOf(this.voice);
    select.value = idx >= 0 ? String(idx) : prev;
  }

  // Pick the starting voice from the theme settings: an explicit default
  // language, a fallback language, then the platform's default language,
  // then the first voice available on the device. A user's own choice wins
  // over all. The settings are enums of language codes; "auto" is treated
  // as no preference by the matcher.
  applyDefaultSelection() {
    if (this.voiceChosen) {
      return;
    }
    const selection = selectVoice(this.synth.getVoices(), {
      defaultVoice: settings.default_voice,
      fallbackVoice: settings.fallback_voice,
      platformLang: document.documentElement.lang,
    });
    this.voice = selection.voice;
    this.voiceLang = selection.lang;
  }

  collectBlocks() {
    const skip = [];
    if (settings.skip_code_blocks) {
      skip.push("pre", "code");
    }
    if (settings.skip_quotes) {
      skip.push("blockquote", "aside.quote");
    }
    const skipSelector = skip.join(",");

    return [...this.cooked.querySelectorAll(BLOCK_SELECTOR)].filter((el) => {
      if (el.closest(".tts-player") || !el.textContent.trim()) {
        return false;
      }
      if (skipSelector && el.closest(skipSelector)) {
        return false;
      }
      // Keep only top-most blocks so nested quotes/lists aren't read twice.
      const parentBlock = el.parentElement?.closest(BLOCK_SELECTOR);
      return !parentBlock || !this.cooked.contains(parentBlock);
    });
  }

  // Split a block's text at sentence boundaries so no single utterance
  // exceeds Chrome's silent-cutoff limit. Highlighting stays at block level.
  chunkBlock(el) {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (text.length <= MAX_UTTERANCE_LENGTH) {
      return [{ el, text }];
    }
    const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [text];
    const chunks = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && (current + sentence).length > MAX_UTTERANCE_LENGTH) {
        chunks.push({ el, text: current.trim() });
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) {
      chunks.push({ el, text: current.trim() });
    }
    return chunks;
  }

  toggle() {
    if (this.state === "playing") {
      this.synth.pause();
      this.state = "paused";
      this.updateUI();
    } else if (this.state === "paused") {
      this.synth.resume();
      this.state = "playing";
      this.updateUI();
    } else {
      this.start();
    }
  }

  start() {
    this.blocks = this.collectBlocks().flatMap((el) => this.chunkBlock(el));
    if (!this.blocks.length) {
      this.announce(T("empty"));
      return;
    }
    // iOS may only populate voices after the first user gesture.
    this.loadVoices();
    if (activePlayer && activePlayer !== this) {
      activePlayer.stop();
    }
    activePlayer = this;
    this.index = 0;
    this.state = "playing";
    this.speakCurrent();
  }

  speakCurrent() {
    const gen = ++this.gen;
    this.synth.cancel();

    const chunk = this.blocks[this.index];
    if (!chunk) {
      this.finish();
      return;
    }
    this.highlight(chunk.el);

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.rate;
    utterance.lang = this.voice?.lang || this.voiceLang || "en-US";
    if (this.voice) {
      utterance.voice = this.voice;
    }

    utterance.onend = () => {
      if (gen !== this.gen || this.state !== "playing") {
        return;
      }
      this.index += 1;
      if (this.index >= this.blocks.length) {
        this.finish();
      } else {
        this.speakCurrent();
      }
    };
    utterance.onerror = (event) => {
      if (gen !== this.gen) {
        return;
      }
      if (event.error === "canceled" || event.error === "interrupted") {
        return;
      }
      // Real failures (synthesis-unavailable, audio-busy, not-allowed,
      // text-too-long, …) — surface them instead of failing silently.
      // eslint-disable-next-line no-console
      console.warn(`[tts-listen] speech synthesis failed: ${event.error}`);
      this.finish();
      this.announce(T("failed")); // after finish() so it isn't overwritten
    };

    // Speaking immediately after cancel() silently drops the utterance on
    // iOS Safari and is flaky on Chrome — give the engine a moment.
    setTimeout(() => {
      if (gen === this.gen && this.state === "playing") {
        this.synth.speak(utterance);
      }
    }, 50);
    this.updateUI();
  }

  stop() {
    this.gen += 1;
    this.state = "idle";
    this.synth.cancel();
    this.clearHighlight();
    if (activePlayer === this) {
      activePlayer = null;
    }
    this.unregister();
    this.updateUI();
  }

  // Called by Discourse when the post element is removed or re-rendered.
  // Speech deliberately keeps going: a re-rendered post (scrolled out of
  // view and back, stream updates) re-attaches the same player instead of
  // starting over. The player is fully stopped by stop(), finish(), or
  // navigating away.
  detach() {
    this.synth.removeEventListener?.("voiceschanged", this.onVoicesChanged);
    this.clearHighlight();
    this.cooked = null;
    // An idle player has nothing worth preserving across the re-render.
    if (this.state !== "playing" && this.state !== "paused") {
      this.unregister();
    }
  }

  // Re-attach a still-speaking player to a freshly rendered post element.
  // Only DOM bindings are refreshed — the reading position and voice state
  // carry over untouched.
  attach(cooked, postNumber) {
    this.cooked = cooked;
    this.postNumber = postNumber;

    // The old block/chunk nodes are detached; re-collect from the fresh
    // element so highlighting and the remaining speech track the new DOM.
    if (this.blocks.length) {
      const fresh = this.collectBlocks().flatMap((el) => this.chunkBlock(el));
      this.blocks = remapChunks(this.blocks, fresh);
    }

    this.buildUI();
    this.updateUI();
    this.loadVoices();

    this.onVoicesChanged = () => this.loadVoices();
    this.synth.addEventListener?.("voiceschanged", this.onVoicesChanged);

    if (this.blocks[this.index]) {
      this.highlight(this.blocks[this.index].el);
    }
  }

  unregister() {
    if (this.postId != null && players.get(this.postId) === this) {
      players.delete(this.postId);
    }
  }

  finish() {
    this.gen += 1;
    this.state = "done";
    this.synth.cancel();
    this.clearHighlight();
    if (activePlayer === this) {
      activePlayer = null;
    }
    this.unregister();
    this.updateUI();
  }

  highlight(el) {
    this.clearHighlight();
    el.classList.add("tts-speaking");
    this.currentBlock = el;
  }

  clearHighlight() {
    if (this.currentBlock) {
      this.currentBlock.classList.remove("tts-speaking");
      this.currentBlock = null;
    }
  }

  announce(msg) {
    this.status.textContent = msg;
  }

  updateUI() {
    const labels = {
      idle: T("listen"),
      playing: T("pause"),
      paused: T("resume"),
      done: T("listen"),
    };
    this.playBtn.textContent = labels[this.state];
    this.playBtn.setAttribute(
      "aria-pressed",
      this.state === "playing" ? "true" : "false"
    );
    this.stopBtn.disabled = this.state === "idle" || this.state === "done";
    this.announce(
      {
        idle: "",
        playing: T("playing"),
        paused: T("paused"),
        done: T("finished"),
      }[this.state]
    );
  }
}
