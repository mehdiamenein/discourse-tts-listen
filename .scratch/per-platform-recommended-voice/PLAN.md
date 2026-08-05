# Feature: per-platform recommended voice within the resolved language

Implements [ADR 0008](../../docs/adr/0008-per-platform-recommended-voice.md).
See also [research 0002](../../docs/research/0002-per-platform-voice-names.md)
and the amended [ADR 0005](../../docs/adr/0005-voice-settings-are-language-codes.md).
Branch: `feat/per-platform-recommended-voice` (off `main`, squash-merge).

**The ADR, research note, ADR 0005 amendment, and CONTEXT glossary update are
already written in the working tree (uncommitted). Commit 1 commits them.**

## Problem Statement

Among the several voices a device reports for the resolved language (e.g.
German: Anna, Hedda, Google Deutsch, …), the automatic default — the voice
used when the visitor has not chosen — is "whichever `getVoices()` returns
first". That order is unspecified by the spec and differs per browser, so the
default is effectively random and frequently the robotic one. The admin
cannot fix this by pinning a voice name: voice names are disjoint across
platforms ("Anna" is Apple only, "Microsoft Hedda - German (Germany)" is
Windows only, "Google Deutsch" is Chrome desktop only, Android reports names
like `Android Speech Recognition and Synthesis from Google de-de-x-dea-network`),
and macOS localizes voice names by system locale. ADR 0005 deliberately made
pinning a name out of scope.

Research 0002 found that the Readium Speech project maintains, per language,
a curated list of recommended voices carrying exactly the fields a
per-platform default needs: `name`, `altNames` (Android aliases),
`localizedName: "apple"` (macOS locale variants), `os`, `browser`, `quality`,
`preloaded`.

## Solution

The admin still configures only a *language* (`default_voice`, unchanged). The
component ships a **vendored, compact recommended-voice index** (derived from
Readium Speech) and, *within the resolved language*, prefers the best voice
for the detected platform. The new step is a **layer, not a replacement**:
ADR 0006's ladder, the auto-gates-platform rule, and the no-voice notice are
untouched. No new setting, no migration.

Locked decisions:

1. **Vendor** a compact index for the languages in the `default_voice` enum
   that Readium covers. No runtime fetch (ADR 0003 — self-contained).
2. **Ranking within a language** (deterministic, in priority order):
   `regionMatch` → `preloaded` → `quality` (`veryHigh` > `high` > `normal` >
   `low`) → `localService` (offline, a device-voice property) → index order.
   `defaultRegion` from the table is preferred when the admin set a bare
   family code (e.g. `de` → prefer `de-DE` voices).
3. **Layer:** split `findForLang` into `collectForLang` + `pickVoiceForLang`;
   `pickVoiceForLang` runs `preferRecommendedVoice` then falls back to the
   first collected voice (today's behavior). `selectVoice` threads
   `{recommended, platform}` through. Ladder logic unchanged.
4. **Android honesty** stays — written in ADR 0008; the index is a desktop/iOS
   refinement, not an Android fix; the no-voice notice stays best-effort there.
5. **Matching** a recommended entry to a device voice:
   `device.name === recommended.name` **or** `device.name` ∈
   `recommended.altNames`; when `recommended.localizedName === "apple"`, also
   match `recommended.name` against the Apple-localized display name (best
   effort — `device.name` is the only signal available).
6. **No setting, no migration.** This avoids the PR #26 migration failure
   class entirely.

### Regression invariants (must be enforced by tests)

- **I1 — No-op when no recommendation resolves.** When
  `preferRecommendedVoice` returns `null` (no recommended name installed, or
  the language isn't in the index), `pickVoiceForLang` returns *exactly* the
  voice `findForLang` returns today — a pure no-op regression guard.
- **I2 — The notice never fires because of this change.** Adding a
  recommended-voice index can never change `selectVoice`'s `matched` flag: a
  language that has a voice stays `matched:true`; the recommendation only
  picks *which* voice. The no-voice notice fires under exactly the same
  conditions as before.

## Commits

Each commit leaves the tree green (lint + all tests pass). Tests are written
first within each commit (red→green), then the implementation. Conventional
Commits, scoped `(voice)`.

1. **`docs(adr): per-platform recommended-voice ADR 0008 (EN+DE), amended 0005, glossary, research 0002`**
   — Create branch `feat/per-platform-recommended-voice` off `main`. Commit
   the already-written docs: `docs/adr/0008-per-platform-recommended-voice.md`,
   `docs/adr/0008-per-platform-recommended-voice.de.md`,
   `docs/research/0002-per-platform-voice-names.md`, the amended
   `docs/adr/0005-…md` status preamble, and the `CONTEXT.md` glossary update
   (new **Recommended voice** and **Platform tag** terms, amended **Default
   voice**). No code change; sets the record of decisions before code lands
   (the repo's ADR-before-code convention).

2. **`feat(voice): pure platform detection (navigator → Readium os/browser tags)`**
   — New pure module `javascripts/discourse/lib/tts-platform.js` exporting
   `detectPlatform(navigator) → { os: string[], browser: string[] }`. Tags
   follow Readium: `os` ∈ `macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/`ChromeOS`,
   `browser` ∈ `Edge`/`ChromeDesktop`. Return **arrays** of candidate tags so
   iPad (reports Mac UA) can carry `["iPadOS","macOS"]`. Detection rules:
   - `userAgentData?.platform` preferred when present, else `userAgent`/
     `platform`.
   - iPhone/iPod → `os:["iOS"]`; iPad → `os:["iPadOS","macOS"]`; Mac →
     `os:["macOS"]`; Windows → `os:["Windows"]`; Android → `os:["Android"]`;
     ChromeOS/CrOS → `os:["ChromeOS"]`.
   - Browser: Edge (`Edg/` in UA) → `browser:["Edge"]` (and *not*
     `ChromeDesktop`, even though Edge is Chromium); Chrome desktop (UA has
     `Chrome/` and not mobile and not `Edg/`) → `browser:["ChromeDesktop"]`;
     everything else → `browser:[]` (Safari, Firefox, mobile browsers — no
     browser-specific recommended voices).
   New test `test/javascripts/unit/tts-platform-test.js`: one case per rule
   (Mac/Safari, Mac/Chrome, Win/Edge, Win/Chrome, iPhone Safari, iPad Safari,
   Android Chrome, ChromeOS), plus an empty/odd navigator returns `[]`s.

3. **`feat(voice): vendored recommended-voice index + pure preferRecommendedVoice`**
   — New pure module `javascripts/discourse/lib/tts-recommended-voices.js`
   exporting `RECOMMENDED_VOICES` (the index) and
   `preferRecommendedVoice(voicesForLang, lang, { recommended, platform }) →
   voice | null`.
   - **Index shape**, keyed by two-letter family, derived from Readium
     `json/<lang>.json` for the core languages first (`de`, `en`, `fr`, `es`,
     `it`, `pt`, `nl` — expand later via the refresh note). Each entry:
     `{ defaultRegion: "de-DE", voices: [ { name, altNames?, localizedName?,
     language, os: [], browser: [], quality: [], preloaded? }, … ] }`. Drop
     `testUtterance`, `pitch`, `rate`, `note`, `gender`, `children`,
     `multiLingual`, `nativeID` (not needed for selection). Keep `altNames`
     and `localizedName:"apple"` — they are essential for Android aliases and
     macOS locale variants.
   - **`preferRecommendedVoice`**: `target = normalizeLang(lang)`; `family =
     target.split("-")[0]`; `table = recommended[family]`; if absent → `null`
     (degrade, I1). `region = target !== family ? target : table.defaultRegion`.
     Filter `table.voices` to those whose `os`/`browser` accept the device
     platform: `voice.os.length === 0 || voice.os.some(t ⇒
     platform.os.includes(t))`, same for `browser`. Rank the survivors by
     `[regionMatch (voice.language normalized === region), preloaded?1:0,
     qualityRank (veryHigh3>high2>normal1>low0, using the max of the
     `quality` array), index order]`. For each ranked entry in order, find the
     first device voice in `voicesForLang` whose `name === entry.name` **or**
     `name` ∈ `entry.altNames`; when `entry.localizedName === "apple"`, also
     accept `name === entry.name` against the Apple display name (best effort:
     only `device.name` is available, so this is the same comparison — the
     flag is retained for future use and for documentation). Among device
     voices matching the *same* entry, prefer `localService === true`. Return
     the first match found; if none, return `null`.
   New test `test/javascripts/unit/tts-recommended-voices-test.js`: ranking
   order (preloaded > quality), `altNames` match (Android ugly name → voice),
   `localizedName:"apple"` path, `defaultRegion` preferred for bare family
   code (`de` → de-DE voice beats de-AT), platform filter excludes an Edge-only
   entry on Safari, degrade-to-`null` when language absent from the index, and
   degrade-to-`null` when no recommended name is installed.

4. **`refactor(voice): split findForLang into collectForLang + pickVoiceForLang; thread recommended+platform through selectVoice`**
   — In `javascripts/discourse/lib/tts-selection.js`:
   - Replace `findForLang(voices, lang)` with `collectForLang(voices, lang) →
     voice[]` (ordered: exact-normalized matches first, then family-prefix
     matches, deduped by reference) and `pickVoiceForLang(voices, lang, ctx)
     → voice | null` = `preferRecommendedVoice(collectForLang(…), lang, ctx)
     || collected[0] || null`.
   - `selectVoice` gains `recommended = {}` and `platform = {os:[],browser:[]}`
     in its options and passes `{recommended, platform}` to `pickVoiceForLang`
     at the `defaultVoice`, `platformLang`, and `browserLangs` steps, and to
     the `userVoice` same-language step. The `userVoice` *exact* identity
     match is unchanged (name-based). `isAutoValue`, `normalizeLang`, the
     ladder order, the auto-gates-platform rule, the `intendedLang` for the
     notice, and the `{voice:null, matched:false}` terminal are all
     unchanged.
   - Update `test/javascripts/unit/tts-selection-test.js` to the new
     `selectVoice` signature (pass a small `recommended` fixture and a
     `platform`). Add the two invariant tests verbatim:
     - **I1**: with `recommended:{}` (no entries) and `platform:{os:[],browser:[]}`,
       `selectVoice` returns the same `voice` and `matched` it returned
       before this refactor for each ladder level.
     - **I2**: for a fixture where the resolved language has voices, `matched`
       is `true` both with and without a matching recommended entry; the
       recommendation changes *which* voice, never *whether* one was found.

5. **`feat(voice): wire recommended-voice preference into the player`**
   — In `javascripts/discourse/api-initializers/tts-listen.js`:
   - Import `detectPlatform` and `RECOMMENDED_VOICES`.
   - In `TTSPlayer` constructor, set `this.platform = detectPlatform(navigator)`
     once (it does not change for the page lifetime).
   - In `applyDefaultSelection`, pass `recommended: RECOMMENDED_VOICES` and
     `platform: this.platform` into `selectVoice`. Nothing else changes: the
     visitor override, `voiceChosen`, `voicesLoaded`, the no-voice notice, and
     the drop-down are untouched.
   No `settings.yml`, `locales/*.yml`, or migration change. No new behavior
   beyond the within-language voice refinement.

6. **`docs: refresh note for the vendored recommended-voice index + README mention`**
   — Add `docs/research/0002-refresh-recommended-voices.md` (or a short
   `scripts/refresh-recommended-voices.md` note) documenting how to regenerate
   `tts-recommended-voices.js` from Readium `json/*.json`: which fields are
   kept/dropped, the core-language set, the compact shape, and a release-
   checklist reminder to re-vendor periodically. Update the "How the voice is
   chosen" section of `README.md` and `README.de.md` with one sentence: the
   component prefers a curated per-platform voice within the resolved
   language, falling back to any voice of the language.

7. **(github-operations) version bump + PR**
   — Bump `about.json` `theme_version` `0.3.0 → 0.4.0` (minor: a behavior
   change to the default voice within a language; no setting/migration).
   Push the branch, open the PR (Conventional Commits, links ADR 0008 +
   research 0002, notes no setting/migration change, notes the
   `frontend_tests` CI job is active). Gate: CI green before merge.
   **Hand off to user; do not merge until confirmed.**

## Decision Document

- **Modules**
  - `javascripts/discourse/lib/tts-platform.js` — new pure module:
    `detectPlatform(navigator) → {os: string[], browser: string[]}`.
  - `javascripts/discourse/lib/tts-recommended-voices.js` — new pure module:
    `RECOMMENDED_VOICES` (vendored index) + `preferRecommendedVoice(...)`.
  - `javascripts/discourse/lib/tts-selection.js` — `findForLang` split into
    `collectForLang` + `pickVoiceForLang`; `selectVoice` threads
    `{recommended, platform}`. `normalizeLang`, `groupVoicesByLang`, the
    ladder, `isAutoValue`, the `matched` flag, and the terminal all unchanged.
  - `javascripts/discourse/api-initializers/tts-listen.js` — player:
    `this.platform` once; passes `recommended` + `platform` into
    `selectVoice`. Nothing else.
- **Interfaces**
  - `detectPlatform(navigator) → { os: string[], browser: string[] }`.
  - `preferRecommendedVoice(voicesForLang, lang, { recommended, platform }) →
    voice | null`.
  - `collectForLang(voices, lang) → voice[]`; `pickVoiceForLang(voices, lang,
    {recommended, platform}) → voice | null`.
  - `selectVoice(voices, { userVoice, defaultVoice, platformLang, browserLangs,
    recommended = {}, platform = {os:[],browser:[]} }) → { voice, lang, matched }`.
  - `RECOMMENDED_VOICES` shape: `{ "<family>": { defaultRegion: "<REGION>",
    voices: [{ name, altNames?, localizedName?, language, os: [], browser: [],
    quality: [], preloaded? }] } }`.
- **Settings / locales / migration** — none. No `settings.yml`, locale, or
  migration change. This is the whole point: it avoids the PR #26 failure
  class and keeps ADR 0005's "admin configures a language only" intact.
- **Ranking** (priority order, deterministic): `regionMatch` → `preloaded` →
  `quality` (veryHigh3 > high2 > normal1 > low0, max of the array) →
  `localService` (device-voice, prefer offline) → index order.
- **Matching** — `device.name === entry.name` OR ∈ `entry.altNames`; Apple
  localized best-effort via `localizedName:"apple"` (only `device.name`
  available today; flag retained for documentation/future).
- **Platform tags** — Readium `os`/`browser`; arrays of candidates so iPad
  (Mac UA) carries `["iPadOS","macOS"]`; entries with empty `os`/`browser`
  are considered available everywhere.
- **Android caveat** — documented openly in ADR 0008 and the README: Chrome
  Android lists phantom voices, so the recommendation is best-effort there
  and the no-voice notice remains best-effort.

## Testing Decisions

- **Test-first within each commit** (red→green), per the repo's TDD convention.
- **Only test external behavior** of pure modules via their public functions;
  the player's DOM glue is exercised by lint + the CI `frontend_tests` job
  (already active), not hand-rolled DOM unit tests.
- **Modules tested**:
  - `tts-platform-test.js` — one case per detection rule + empty navigator.
  - `tts-recommended-voices-test.js` — ranking, `altNames`, `localizedName`,
    `defaultRegion`, platform filter, degrade-to-null (absent language, no
    installed recommended name).
  - `tts-selection-test.js` (updated) — new `selectVoice` signature across
    every ladder level, the auto-gates-platform rule, override
    exact/same-lang/fallthrough, `matched` flag, plus the **I1** and **I2**
    invariant tests.
  - `tts-lifecycle-test.js` and `tts-speed-test.js` stay green untouched.
- **Prior art**: `test/javascripts/unit/tts-selection-test.js`,
  `tts-lifecycle-test.js`, `tts-speed-test.js` — same QUnit + plain-objects
  style.
- **No migration tests** — there is no migration.

## Out of Scope

- An admin-facing voice-name setting (the admin configures a language only;
  the component ships the curated per-platform preference).
- Runtime fetch of the Readium index (ADR 0003 — self-contained).
- Detecting whether a listed Android voice is *actually installed* — the Web
  Speech API exposes no such signal; the phantom-voice caveat stands.
- Expanding the vendored index beyond the core languages in the first cut
  (de/en/fr/es/it/pt/nl); uncovered languages degrade gracefully to today's
  behavior. Expansion is a refresh-script follow-up.
- Changing ADR 0006's ladder, the auto-gates-platform rule, or the no-voice
  notice.
- A per-visitor recommended-voice override — the visitor override
  (`{lang,name}`) already wins and is unchanged.

## Further Notes

- Execution order is dependency-driven: platform detection and the vendored
  index land first (pure, no wiring); the `selectVoice` refactor threads them
  through with the invariant tests; the player wires them in last; docs land
  last, describing shipped behavior; the version bump + PR is the gate.
- Each commit is small enough to review in isolation and to bisect if CI
  breaks.
- The two regression invariants (I1, I2) are the heart of "this change can
  only improve selection, never break it" — they are the first thing to check
  if any later change touches `selectVoice`.