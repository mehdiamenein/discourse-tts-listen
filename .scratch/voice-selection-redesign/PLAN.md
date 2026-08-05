# Refactor: voice-selection redesign + speed dropdown

Implements ADR 0006 (`docs/adr/0006-voice-selection-redesign.md`) and ADR 0007
(`docs/adr/0007-speed-dropdown-and-persistence.md`). See also
`docs/research/0001-android-voice-selection-bug.md` for the root-cause
analysis. Branch: `feat/voice-selection-redesign` (off `main`, squash-merge).

Master issue: #1. Tickets (execution order):

| # | Ticket | Depends on |
| --- | --- | --- |
| #2 | docs(adr): ADRs/glossary/research/note | — |
| #3 | refactor(voice): normalize lang codes | — |
| #4 | refactor(voice): selection ladder + override + browser terminal + matched | #3 |
| #10 | feat(voice): persist user override; grouped drop-down; revert | #4 |
| #18 | feat(voice): no-voice notice; remove list[0]; show_no_voice_notice | #10 |
| #20 | chore(settings): remove fallback_voice (migrate to auto) | #18 |
| #21 | feat(speed): 0.1–2.0 drop-down, aligned default_rate, persisted | — (parallel) |
| #22 | docs: rewrite README (EN) | #20, #21 |
| #23 | docs: add README.de.md | #22 |
| #24 | chore(release): bump 0.2.0→0.3.0 + open PR (gate) | all |

## Problem Statement

A customer on Android received Indian (hi-IN / en-IN) text-to-speech by
default on a German forum despite the admin configuring German with both the
`default_voice` and `fallback_voice` settings. The selection ladder fell
through every step and landed on `speechSynthesis.getVoices()[0]`, whose order
is unspecified and on Chrome Android is frequently an Indian voice.

Root cause (research 0001): (1) Chrome Android returns an *unfiltered* voice
list; (2) the matcher compares `lang` with `startsWith("de-")` and so never
matches Android underscore codes (`de_DE`) or Firefox three-letter codes
(`deu-DEU-f00`) — the admin's German setting silently failed; (3) `list[0]`
and `voice.default` are unreliable terminal fallbacks.

On top of this, the speed drop-down uses coarse 0.25 steps (`0.75, 1, 1.25,
1.5, 2`) and disagrees with the `default_rate` range (0.5–3.0 vs. a 2.0
drop-down cap), and neither the chosen voice nor the chosen speed persists
across sessions.

## Solution

- **Normalize** every voice `lang` before matching (`_`→`-`; map Firefox
  three-letter primaries to two-letter for the supported languages). This
  resolves the customer complaint on desktop/iOS and most of Android.
- **New selection ladder** in the pure `tts-selection.js` module, returning a
  `matched` flag: user override → `default_voice` → platform language (only
  when `default` is `auto`) → `navigator.languages` matched against real
  normalized voices → `{voice:null, matched:false}`. **Never `list[0]`.**
- **No silent language switch.** When nothing matches, the player shows a
  small, non-dismissible, localized **no-voice notice** (behind a new
  `show_no_voice_notice` setting, default `true`); the visitor picks another
  voice themselves via the drop-down.
- **Drop the `fallback_voice` setting** (migration `0002` → `auto`). No
  second configured language; the notice replaces it.
- **Persist the user voice choice** as a voice identity `{lang, name}` in
  `localStorage`, site-wide; the drop-down lists device voices grouped by
  language with a "Default (admin)" option that clears the override (revert).
- **Speed drop-down: 0.1–2.0 in 0.1 steps** (20 options); `default_rate`
  aligned to `min 0.1, max 2.0, default 1.0`; chosen rate persisted in
  `localStorage` with the same revert semantics; live-restart on change kept.

## Commits

Each commit leaves the codebase green (lint + existing tests pass). Tests are
written first within each commit (red→green), then the implementation.

1. **`docs(adr): voice-selection redesign and speed ADRs, amended 0001, glossary, research, workflow note`**
   — Commit the domain-modeling artifacts already written: ADR 0006 (EN+DE),
   ADR 0007 (EN+DE), amended ADR 0001, updated `CONTEXT.md`,
   `docs/research/0001-…`, and `note.md`. No code change; sets the record of
   decisions before the code lands.

2. **`refactor(voice): normalize voice lang codes before matching`**
   — Add `normalizeLang(code)` in `tts-selection.js`: lowercase, `_`→`-`, and
   map Firefox three-letter primaries (`deu`→`de`, `eng`→`en`, …) for the
   languages in the settings drop-down. Use it inside `findForLang` on both the
   needle and the voice `lang`. Tests: `de_DE` matches `de`; `deu-DEU-f00`
   matches `de-DE`; `de` matches `de-AT`; case-insensitive; `en-GB` unchanged.
   No behavior change to currently-passing cases; previously-unmatched voices
   now resolve.

3. **`refactor(voice): selection ladder with override, browser-language terminal, matched flag`**
   — Rewrite `selectVoice(voices, { userVoice, defaultVoice, platformLang,
   browserLangs })` → `{ voice, lang, matched }`. Ladder: `userVoice` (exact
   `{lang,name}` → any voice of that language → fall through) → `defaultVoice`
   (if not `auto`) → `platformLang` (only when `defaultVoice` is `auto`) →
   `browserLangs` in order → `{voice: list[0], lang, matched:false}`
   (list[0] kept *temporarily* this commit so the player still works; removed
   in commit 5). Update `applyDefaultSelection` in the player to pass the new
   args (`browserLangs = navigator.languages`, `userVoice = null` for now) and
   ignore `matched`. Update `test/javascripts/unit/tts-selection-test.js` to
   the new signature; add tests for every ladder level, the `auto`-gates
   -platform rule, override exact/same-lang/fallthrough, and `matched=false`.

4. **`feat(voice): persist user voice override; grouped drop-down; revert`**
   — Extract a pure `groupVoicesByLang(voices)` (→ ordered `[{lang, voices}]`)
   and test it. Player: read `tts.voice` (`{lang,name}`) from `localStorage`
   on construct and on `voiceschanged`; pass it as `userVoice`; on drop-down
   change, save the chosen `{lang,name}`; render voices grouped by language in
   `<optgroup>`s; add a top "Default (admin)" option (locale key
   `tts_listen.default_voice_option`) that clears the stored override and
   re-runs `applyDefaultSelection`. The override wins via the ladder from
   commit 3.

5. **`feat(voice): no-voice notice; remove list[0] fallback; show_no_voice_notice`**
   — `selectVoice` now returns `{voice:null, matched:false}` when nothing
   matches (no `list[0]`). Player: when `matched === false` and
   `settings.show_no_voice_notice`, render a small non-dismissible red inline
   notice with the localized `tts_listen.no_voice` string (the configured
   language interpolated in); disable starting playback while no voice
   matches (the drop-down remains usable so the visitor can pick one).
   `settings.yml`: add `show_no_voice_notice` (bool, default `true`).
   `locales/en.yml` + `de.yml`: add `tts_listen.no_voice` and the
   `show_no_voice_notice` setting description. Tests: `selectVoice` returns
   `matched:false`, `voice:null` when nothing matches; the notice string
   carries the configured language.

6. **`chore(settings): remove fallback_voice setting (migrate to auto)`**
   — `migrations/settings/0002-remove-fallback-voice.js`: delete the stored
   `fallback_voice` value. `settings.yml`: remove the `fallback_voice` block.
   `locales/en.yml` + `de.yml`: remove the `fallback_voice` label/description
   and relabel `default_voice` to "Preferred voice language (the player tries
   this first)" / DE equivalent. `tts-selection.js` already ignores
   `fallbackVoice`. Follows migration `0001`'s (untested) pattern.

7. **`feat(speed): 0.1–2.0 drop-down in 0.1 steps, aligned default_rate, persisted`**
   — Extract pure `buildSpeedOptions()` → `[0.1 … 2.0]` step 0.1 (test it).
   `settings.yml`: `default_rate` → `min 0.1, max 2.0, default 1`. Player
   `buildUI`: render `buildSpeedOptions()`, pre-select nearest grid value to
   `this.rate`; on change persist `tts.rate` in `localStorage`; on revert
   (a "Default" speed option) clear it and fall back to `default_rate`;
   keep the live-restart-on-change behavior. Tests: `buildSpeedOptions`
   length/step; nearest-grid snap for an off-grid `default_rate`.

8. **`docs: rewrite README (EN) for the new ladder, speed, and settings`**
   — Update `README.md`: features, settings table (removed `fallback_voice`;
   new `show_no_voice_notice`; `default_rate` 0.1–2.0; speed 0.1–2.0),
   "How the voice is chosen" rewritten to the new ladder with the override,
   notice, and the honest Android phantom-voice caveat.

9. **`docs: add README.de.md (German mirror)`**
   — Full German translation of the updated `README.md`, matching the existing
   German locale voice.

10. **(github-operations) version bump + PR**
   — Bump `about.json` `theme_version` `0.2.0 → 0.3.0` (minor: additive
   settings + a removal with migration + behavior changes). Push the branch,
   open the PR (Conventional Commits, links ADR 0006/0007, notes the
   `frontend_tests` CI job is already active). Gate: CI green before merge.
   **Hand off to user; do not merge until confirmed.**

## Decision Document

- **Modules**
  - `javascripts/discourse/lib/tts-selection.js` — pure module; gains
    `normalizeLang`, a new `selectVoice` signature and a `matched` return.
  - `javascripts/discourse/api-initializers/tts-listen.js` — player; reads
    `localStorage` overrides, renders the grouped drop-down, the no-voice
    notice, the new speed options; wires `show_no_voice_notice`.
  - New pure helpers live in `tts-selection.js` (`normalizeLang`,
    `groupVoicesByLang`, `buildSpeedOptions`) to keep logic unit-testable.
- **Interfaces**
  - `selectVoice(voices, { userVoice, defaultVoice, platformLang, browserLangs })`
    → `{ voice, lang, matched }`.
  - `userVoice` is `{ lang, name } | null`; persistence shape in `localStorage`
    keys `tts.voice` and `tts.rate`.
- **Settings (`settings.yml`)**
  - Remove `fallback_voice`. Add `show_no_voice_notice` (bool, default `true`).
  - `default_rate`: `min 0.1, max 2.0, default 1` (no `step` field — Discourse
    float settings don't take one; the 0.1 grid is enforced by the drop-down
    options).
- **Locales** — `locales/en.yml`, `locales/de.yml`: add `tts_listen.no_voice`
  and `tts_listen.default_voice_option`; add `show_no_voice_notice` setting
  description; remove `fallback_voice` entries; relabel `default_voice`.
- **Migration** — `migrations/settings/0002-remove-fallback-voice.js` deletes
  the stored `fallback_voice`, following `0001`'s pattern.
- **Android caveat** — documented openly in ADR 0006 and the README: Chrome
  Android lists phantom voices, so the notice is best-effort there.

## Testing Decisions

- **Only test external behavior.** Pure modules are tested via their public
  functions; the player's DOM glue is exercised by lint + the CI
  `frontend_tests` job (already active), not by hand-rolled DOM unit tests.
- **Modules tested**: `tts-selection.js` (normalization, every ladder level,
  override resolution, `matched` flag, no `list[0]`), `groupVoicesByLang`,
  `buildSpeedOptions`. The existing `tts-lifecycle-test.js` stays green.
- **Prior art**: `test/javascripts/unit/tts-selection-test.js` and
  `tts-lifecycle-test.js` — the same QUnit + plain-objects style. New tests
  extend `tts-selection-test.js` and add a small `tts-options-test.js` for the
  new pure helpers.
- **Migrations** follow `0001`'s untested pattern (no Discourse settings
  facade available in unit tests); verified by review and the settings enum
  list.

## Out of Scope

- Pinning a *specific voice name* (only a language is configured; voices are
  per-device and unstable).
- Detecting whether a listed Android voice is *actually installed* — the Web
  Speech API exposes no such signal; the phantom-voice caveat stands.
- "Listen to whole topic" mode, word-level highlighting, server-side TTS —
  unchanged roadmap items.
- A per-post or per-topic override scope — the override is deliberately
  site-wide.
- Branch protection on `main` is configured separately as a repo setting (a
  prerequisite step, not a commit).

## Further Notes

- Execution order is dependency-driven: normalization and the pure ladder
  land first; the player's override, notice, and speed features build on them;
  the `fallback_voice` removal lands only after the module no longer uses it;
  docs land last, describing shipped behavior.
- Each commit is small enough to review in isolation and to bisect if CI
  breaks.