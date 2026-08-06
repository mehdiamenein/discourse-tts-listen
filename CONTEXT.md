# TTS Listen Button

A Discourse theme component that adds an accessible "Listen" button to forum
posts, reading post content aloud with the browser's built-in Web Speech API.
Deliberately simple: one component, no backend, no external services.

## Language

**Listen player**:
The per-post control that plays, pauses, resumes and stops speech.
_Avoid_: widget, player widget, TTS widget

**Block**:
A top-level text element of a post that can be read aloud (`p`, `li`, `h1`–
`h6`, `blockquote`, `td`, `th`, `figcaption`). Elements nested inside another
block are not read separately.
_Avoid_: paragraph, element

**Chunk**:
A sentence-bounded slice of a block that becomes a single speech utterance.
Splitting exists because browsers silently cut off longer utterances.
_Avoid_: utterance, segment (utterance is the Web Speech API's own term; chunk
is ours)

**Platform language**:
The Discourse site's default language — the language the forum is configured
in. Voice selection targets this language as its primary signal; the
visitor's browser language is consulted only as a final resort.
_Avoid_: browser language, site language, locale

**Browser language**:
The visitor's preferred languages as reported by the browser
(`navigator.languages`), consulted only as the last resort of voice
selection, and only matched against voices that actually exist on the device.
_Avoid_: device language, system language, locale

**Default voice**:
The single theme setting that pins a preferred voice *language*, chosen from a
drop-down of language codes (e.g. `de` or `de-DE`). `auto` means no
preference: follow the platform language. There is deliberately no second
"fallback" language setting — see ADR 0006 — and no per-voice-name setting:
the specific voice within the language is chosen per platform from a curated
recommended-voice index — see ADR 0008.
_Avoid_: primary voice, preferred voice

**Recommended voice**:
The device voice the component prefers *within* the resolved language, picked
from a vendored index of curated voices (derived from Readium Speech) keyed by
language and platform. The index carries each voice's `name`, `altNames`
(Android aliases) and `localizedName: "apple"` (macOS localizes voice names by
system locale), with `os`/`browser`, `quality` and `preloaded` fields for
ranking. When no recommended voice is installed, selection falls back to any
voice of the language (today's behavior). The visitor override always wins.
_Avoid_: default voice, preferred voice, pinned voice

**Platform tag**:
The coarse `os`/`browser` label the component derives from `navigator`
(`macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/`ChromeOS`, `Edge`/`ChromeDesktop`),
used to filter the recommended-voice index to voices that exist on the
visitor's device family. A best-effort filter, not authoritative.
_Avoid_: user agent, device fingerprint

**Voice identity**:
The pair `{lang, name}` that identifies a device voice across sessions. The
user override stores a voice identity, never a list index, because the order
of `speechSynthesis.getVoices()` is unstable and device-dependent.
_Avoid_: voice index, voice reference

**User override**:
A voice a visitor deliberately chose in the player's drop-down, stored
per-browser as a voice identity. It wins over every automatic step of voice
selection. Selecting "Default" in the drop-down clears it (see Revert).
_Avoid_: saved voice, voice preference

**Revert**:
Clearing the user override so voice selection runs the full ladder again from
the admin's default. It does not snapshot the admin's current choice.
_Avoid_: reset, restore

**No-voice notice**:
A small, non-dismissible inline warning shown in the player when no voice
speaks the configured language on the visitor's device. It replaces any silent
fallback to another language: the visitor is told what is missing and can pick
another voice themselves.
_Avoid_: error, alert, fallback message

**Normalized language code**:
A voice's `lang` value rewritten to a single canonical form before matching:
underscores become hyphens (`de_DE` → `de-DE`) and Firefox three-letter
prefixes are stripped (`deu-DEU-f00` → `de-DE`). A single comparison then works
across browsers and devices, which is what makes the configured language
actually resolve on Android and Firefox.
_Avoid_: canonical lang, lang normalization

**Voice selection priority**:
The order in which the player picks its starting voice:
user override → default voice setting → platform language (only when the
default is `auto`) → browser language, matched against real device voices →
no-voice notice (no further automatic fallback). The player never picks the
first entry of the device voice list, because that order is unspecified and on
Chrome Android frequently an Indian-English or Hindi voice.
_Avoid_: voice fallback, voice preference

**Active player**:
The single listen player that may speak at a time. Starting one player stops
any other.
_Avoid_: current player, speaking player

**Re-render**:
Discourse removes posts from the DOM when they scroll out of view
("cloaking") and renders them again when they scroll back. The player
survives this: a still-speaking player is detached, then re-attached to the
fresh element — the voice never breaks stride.
_Avoid_: refresh, rerender of the browser

**Theme translations**:
The `locales/*.yml` files that localize the player's controls and the
no-voice notice to the platform's language, looked up via `themePrefix` +
`i18n()`.
_Avoid_: i18n keys, strings file