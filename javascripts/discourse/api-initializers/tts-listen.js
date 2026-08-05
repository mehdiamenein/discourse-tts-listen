import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import { playerForElement, remapChunks } from "../lib/tts-lifecycle";
import { groupVoicesByLang, selectVoice } from "../lib/tts-selection";
import { buildSpeedOptions, DEFAULT_VALUE } from "../lib/tts-speed";

// UI strings come from the theme translations (locales/*.yml), so the player
// speaks the platform's language: German forums get German controls, English
// forums English ones. `themePrefix` is injected into theme modules by
// Discourse (same as `settings`), so no import is needed. The optional
// `options` object is forwarded to `i18n` for `%{name}` interpolation (used by
// the no-voice notice, which names the configured language).
const T = (key, options) => i18n(themePrefix(`tts_listen.${key}`), options);

const BLOCK_SELECTOR =
  "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, figcaption";

// Chrome silently cuts off long utterances (~200-250 chars / ~15s), so long
// blocks are split at sentence boundaries before being queued.
const MAX_UTTERANCE_LENGTH = 250;

// Only one post may speak at a time (speechSynthesis is global).
let activePlayer = null;

// Per-browser override for the playback speed. Absent means "use the admin's
// default_rate"; present means the visitor picked their own speed. Cleared by
// selecting the "Default" drop-down entry (mirrors the voice override).
const RATE_STORAGE_KEY = "tts_listen_rate";

// Per-browser override for the speaking voice, stored as a {lang, name}
// identity (ADR 0006). Absent means "use the automatic ladder"; present means
// the visitor picked their own voice. Cleared by selecting the
// "Default (admin)" drop-down entry, which re-runs the automatic ladder so a
// later admin change is picked up again. An identity — never an index —
// survives a different device or a reordered voice list.
const VOICE_STORAGE_KEY = "tts_listen_voice";

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
    this.rate = this.loadPersistedRate();
    this.userVoice = this.loadPersistedVoice();
    this.voiceOptions = []; // flat voice list backing the grouped drop-down
    this.voice = null;
    this.voiceLang = "";
    this.matched = false; // a configured preference actually resolved a voice
    this.voicesLoaded = false; // the device has reported at least one voice
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
      buildSpeedOptions({
        selectedRate: this.rate,
        defaultLabel: T("default_speed"),
      }),
      T("speed"),
      (val) => {
        if (val === DEFAULT_VALUE) {
          // "Default" reverts to the admin's default_rate and drops the
          // per-browser override.
          this.clearPersistedRate();
          this.rate = Number(settings.default_rate) || 1;
        } else {
          this.rate = parseFloat(val);
          this.writePersistedRate(this.rate);
        }
        if (this.state === "playing" || this.state === "paused") {
          this.state = "playing";
          this.speakCurrent(); // restart current block at the new speed
        }
      }
    );
    root.append(this.speedField.wrapper);

    if (settings.show_voice_selector) {
      this.voiceField = this.makeSelect([], T("voice"), (val) => {
        if (val === "") {
          // "Default (admin)": drop the per-browser override and re-run the
          // automatic ladder, so a later admin change is picked up again.
          this.clearPersistedVoice();
          this.userVoice = null;
          this.voiceChosen = false;
          this.applyDefaultSelection();
        } else {
          const voice = this.voiceOptions[Number(val)];
          if (voice) {
            this.voice = voice;
            this.voiceLang = voice.lang;
            this.voiceChosen = true;
            this.matched = true; // the visitor picked a usable voice
            // Persist a {lang, name} identity, never an index: it survives a
            // reordered or differently-populated voice list.
            this.userVoice = { lang: voice.lang, name: voice.name };
            this.writePersistedVoice(this.userVoice);
          }
        }
        if (this.state === "playing" || this.state === "paused") {
          this.state = "playing";
          this.speakCurrent(); // restart current block in the new voice
        }
        this.updateUI();
      });
      root.append(this.voiceField.wrapper);
    }

    // Polite live region so screen-reader users get state changes.
    this.status = document.createElement("span");
    this.status.className = "tts-sr-only";
    this.status.setAttribute("aria-live", "polite");
    root.append(this.status);

    // Non-dismissible inline notice shown when no installed voice speaks the
    // configured language (issue #18). It stays until the visitor picks a
    // voice from the drop-down or a matching voice appears; it carries the
    // configured language so the visitor knows exactly what is missing.
    this.noVoiceNotice = document.createElement("p");
    this.noVoiceNotice.className = "tts-no-voice";
    this.noVoiceNotice.setAttribute("role", "status");
    this.noVoiceNotice.hidden = true;
    root.append(this.noVoiceNotice);

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
    // otherwise the only path that never re-runs this. The persisted user
    // override is re-read here too, so clearing it (in another tab or by
    // picking "Default") takes effect on the next voiceschanged. A user's
    // own choice in the dropdown still wins (applyDefaultSelection bails out
    // then).
    if (!this.voiceChosen) {
      this.userVoice = this.loadPersistedVoice();
      this.applyDefaultSelection();
    }

    if (!this.voiceField) {
      return;
    }

    const voices = this.synth.getVoices();
    if (!voices.length) {
      return; // still waiting; voiceschanged will fire again
    }
    this.voicesLoaded = true;
    const select = this.voiceField.select;
    select.innerHTML = "";

    // Top "Default (admin)" entry: clears the persisted override and re-runs
    // the automatic ladder, so a later admin change is picked up again.
    const def = document.createElement("option");
    def.value = "";
    def.textContent = T("default_voice_option");
    select.append(def);

    // Voices grouped by language in <optgroup>s, in alphabetical order.
    this.voiceOptions = [];
    for (const { lang, voices: groupVoices } of groupVoicesByLang(voices)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = lang;
      for (const voice of groupVoices) {
        const o = document.createElement("option");
        o.value = String(this.voiceOptions.length);
        o.textContent = `${voice.name} (${voice.lang})`;
        this.voiceOptions.push(voice);
        optgroup.append(o);
      }
      select.append(optgroup);
    }

    // Show the override voice when one is active, otherwise the "Default
    // (admin)" entry. The override identity may outlive the exact voice it
    // named; when that voice is gone the ladder resolves to another, and the
    // drop-down falls back to the Default entry rather than misleadingly
    // highlighting a different voice.
    const hasOverride = this.voiceChosen || this.userVoice != null;
    if (hasOverride && this.voice) {
      const idx = this.voiceOptions.indexOf(this.voice);
      select.value = idx >= 0 ? String(idx) : "";
    } else {
      select.value = "";
    }

    // A newly-arrived voice list can resolve a previously-unmatched ladder
    // (or break one that used to match), so the notice and the play button
    // are refreshed whenever the device reports voices.
    this.updateUI();
  }

  // Per-browser playback-speed override, persisted in localStorage. Absent
  // means "use the admin's default_rate"; selecting "Default" in the drop-down
  // clears it and falls back to default_rate. A concrete choice is stored as
  // a plain number string so it round-trips through parseFloat unchanged.
  loadPersistedRate() {
    try {
      const stored = window.localStorage?.getItem(RATE_STORAGE_KEY);
      if (stored != null && stored !== "") {
        const rate = parseFloat(stored);
        if (Number.isFinite(rate)) {
          return rate;
        }
      }
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe);
      // fall back to the setting silently.
    }
    return Number(settings.default_rate) || 1;
  }

  writePersistedRate(rate) {
    try {
      window.localStorage?.setItem(RATE_STORAGE_KEY, String(rate));
    } catch {
      /* storage unavailable; the in-memory rate still applies this session */
    }
  }

  clearPersistedRate() {
    try {
      window.localStorage?.removeItem(RATE_STORAGE_KEY);
    } catch {
      /* storage unavailable; nothing to clear */
    }
  }

  // Per-browser voice override, persisted as a {lang, name} identity in
  // localStorage. Absent means "use the automatic ladder"; selecting
  // "Default (admin)" clears it and falls back to the ladder. The identity
  // is stored as JSON so both fields round-trip unchanged.
  loadPersistedVoice() {
    try {
      const stored = window.localStorage?.getItem(VOICE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.lang === "string" &&
          typeof parsed.name === "string"
        ) {
          return { lang: parsed.lang, name: parsed.name };
        }
      }
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe) or
      // the stored value may be corrupt; fall back to no override silently.
    }
    return null;
  }

  writePersistedVoice(identity) {
    try {
      window.localStorage?.setItem(VOICE_STORAGE_KEY, JSON.stringify(identity));
    } catch {
      /* storage unavailable; the in-memory voice still applies this session */
    }
  }

  clearPersistedVoice() {
    try {
      window.localStorage?.removeItem(VOICE_STORAGE_KEY);
    } catch {
      /* storage unavailable; nothing to clear */
    }
  }

  // Pick the starting voice from the selection ladder (ADR 0006): a
  // persisted user override, then the admin's default language, then the
  // platform language (only when the default is "auto"), then the browser
  // languages. The user override is the visitor's persisted {lang, name}
  // identity and always wins (the ladder stops re-applying once one is made);
  // it is re-read on construct and on every voiceschanged so a choice made
  // in another tab, or cleared by picking "Default", takes effect here. A
  // user's own dropdown choice always wins over all. When nothing matches
  // the ladder returns {voice: null, matched: false} with the configured
  // language it was trying to satisfy, and the player shows the no-voice
  // notice (issue #18) instead of silently speaking list[0].
  applyDefaultSelection() {
    if (this.voiceChosen) {
      return;
    }
    const selection = selectVoice(this.synth.getVoices(), {
      userVoice: this.userVoice,
      defaultVoice: settings.default_voice,
      platformLang: document.documentElement.lang,
      browserLangs: navigator.languages,
    });
    this.voice = selection.voice;
    this.voiceLang = selection.lang;
    this.matched = selection.matched;
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
    // iOS may only populate voices after the first user gesture, so give
    // the device a chance to report them before deciding a voice is missing.
    this.loadVoices();
    // No matching voice: the no-voice notice is shown and the play button
    // is disabled, but the visitor may still trigger start through a
    // keyboard/AT that bypasses the disabled state — bail here rather than
    // queue an utterance with no voice (issue #18).
    if (!this.matched) {
      this.announce("");
      return;
    }
    this.blocks = this.collectBlocks().flatMap((el) => this.chunkBlock(el));
    if (!this.blocks.length) {
      this.announce(T("empty"));
      return;
    }
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

    // No matching voice: keep the drop-down usable but disable starting
    // playback (issue #18). A play/pause/stop in flight is left alone so a
    // transition that arrives mid-playback does not strand the visitor.
    const canPlay = this.matched;
    const inFlight = this.state === "playing" || this.state === "paused";
    this.playBtn.disabled = !canPlay && !inFlight;

    this.updateNoVoiceNotice();

    this.announce(
      {
        idle: "",
        playing: T("playing"),
        paused: T("paused"),
        done: T("finished"),
      }[this.state]
    );
  }

  // Render or hide the non-dismissible no-voice notice (issue #18). Shown
  // only when no configured voice matched AND the admin enabled it; the
  // configured language the device could not satisfy is interpolated in so
  // the visitor knows exactly what is missing. The drop-down stays usable,
  // so picking a voice hides the notice and re-enables playback.
  updateNoVoiceNotice() {
    if (!this.noVoiceNotice) {
      return;
    }
    // Only show once the device has actually reported voices: getVoices()
    // returns [] on the first call in Chrome/Edge/Firefox and only populates
    // asynchronously via voiceschanged, so a bare !matched check would flash
    // the notice on every first page load even when a matching voice exists.
    const show =
      this.voicesLoaded &&
      !this.matched &&
      Boolean(settings.show_no_voice_notice);
    if (show) {
      this.noVoiceNotice.textContent = T("no_voice", {
        language: this.voiceLang || "",
      });
    }
    this.noVoiceNotice.hidden = !show;
  }
}
