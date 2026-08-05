# Voice selection redesign: drop the fallback setting, normalize codes, prefer a notice over a silent language switch

**Status:** Accepted. Amends ADR 0001. Supersedes ADR 0005's two-setting model
(`default_voice` + `fallback_voice`) with a single `default_voice` setting.

## Context

A customer on Android received Indian (hi-IN / en-IN) text-to-speech by
default despite the admin configuring German, on a German forum, with the
`default_voice` and `fallback_voice` settings both set. The voice selection
ladder silently fell through every step and landed on
`speechSynthesis.getVoices()[0]` — the first device voice — which on Chrome
Android is unspecified and frequently an Indian-English or Hindi voice.

Investigation (see `docs/research/0001-android-voice-selection-bug.md`)
identified three compounding causes:

1. **Chrome Android reports an unfiltered voice list.** `getVoices()` returns
   language/regions whose voice packs are not installed, so "a voice for
   language X is listed" does not mean "language X can actually be spoken".
2. **Voice `lang` codes are not consistently hyphenated.** Android uses
   underscores (`de_DE`); Firefox uses three-letter prefixes (`deu-DEU-f00`).
   The matcher compared with `startsWith("de-")`, so a German voice reported as
   `de_DE` or `deu-DEU-f00` never matched a `default_voice: de`. The admin's
   setting was correct; the matcher simply could not see the installed German
   voice.
3. **`list[0]` and `voice.default` are unreliable terminal fallbacks.** Their
   order and value are unspecified or inconsistent across implementations.

## Decision

1. **Remove the `fallback_voice` setting.** There is no silent fallback to a
   second language. Existing installations are migrated to `auto`.
2. **Normalize every voice `lang` before matching** (`_` → `-`; strip
   `deu-DEU-f00` prefixes). This alone resolves the customer's complaint on
   desktop and iOS.
3. **Never use `list[0]` as a terminal fallback.** The selection ladder is:
   user override → `default_voice` → platform language (only when the default
   is `auto`) → `navigator.languages` matched against real, normalized voices →
   stop, and show the no-voice notice.
4. **Show a no-voice notice** instead of switching languages silently. When no
   voice speaks the configured language, the player displays a small,
   non-dismissible inline warning (localized via theme translations) telling
   the visitor exactly what is missing and that they can pick another voice
   from the drop-down. The visitor decides any language change; the component
   never makes one for them.
5. **Persist the user override as a voice identity `{lang, name}`** in
   `localStorage`, site-wide, resolved on load by exact voice → any voice of
   that language → the automatic ladder. "Default" in the drop-down clears the
   override (revert), so a later admin change is picked up automatically.
6. **Use `navigator.languages` only as the terminal automatic step.** It is the
   spec-recommended visitor-preference signal (`Accept-Language`), and at the
   terminal it is safe — every admin and platform option has already failed, so
   the device has no voice for the configured language anyway.

## Considered options

- **Keep `fallback_voice` and relabel it.** Rejected: a second configured
  language still switches the visitor's language silently, which the team
  considers worse than an honest notice. The setting also duplicated the
  "what to do when the preferred language has no voice" question that the
  notice now answers directly.
- **Silent fallback to `en-US`.** Rejected: biased for an open-source release,
  ignores the visitor's own preference, and is exactly the kind of
  non-transparent switch that caused the original complaint.
- **Hide the player entirely when no configured voice matches.** Rejected: a
  visitor whose device simply lacks the forum's voice pack would lose
  text-to-speech even when other usable voices exist. The notice keeps the
  drop-down usable.

## Consequences

- **Honest Android caveat.** Because Chrome Android lists phantom voices, a
  `de-DE` voice may be "found" and selected even when its pack is not
  installed; the engine may then misbehave. The no-voice notice is fully
  reliable on desktop and iOS, best-effort on Android. This is documented
  openly rather than hidden.
- **ADR 0001 is amended, not reversed.** The platform language remains the
  primary signal; the browser language is added only as a guarded terminal
  step. The German-first guarantee (a German forum with admin on `auto` gets
  German) still holds.
- **One setting removed, one added.** `fallback_voice` is removed
  (migration `0002-…`); `show_no_voice_notice` is added (default `true`).
- **The drop-down changes.** It lists device voices grouped by language, with
  a "Default (admin)" option that reverts the override. Voice choices persist
  as identities, not indices.