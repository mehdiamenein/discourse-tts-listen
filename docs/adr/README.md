# Architecture Decision Records (ADR)

This folder holds every architecture decision for the **discourse-tts-listen**
theme component — one standalone `.md` file per decision, numbered in the order
they were made. Each ADR is immutable: later decisions *amend* or *supersede*
earlier ones in their own files rather than rewriting history.

This README combines all of them into a **single-page overview**: for each
decision it states *what* was decided, *why*, and *how to use* it, then links to
the full file (English `…​.md` and German mirror `…​.de.md`). Read this page for
the whole picture; open an individual ADR for the full reasoning, considered
options, and consequences.

> Conventions: BCP 47 language codes; `auto` = "no preference"; the selection
> **ladder** (ADR 0006) is the ordered resolution user-override → `default_voice`
> → platform language → `navigator.languages` → stop + no-voice notice.

---

## ADR 0001 — Voice language follows the platform's default language, not the visitor's browser

- **Status:** Amended by [ADR 0006](#adr-0006). Platform language stays primary;
  browser language is now only a guarded terminal step.
- **Decision:** The TTS starting language is the Discourse site default
  (`document.documentElement.lang`), not the visitor's browser locale
  (`navigator.language`).
- **Why:** This project serves a German-first community; the forum's language is
  the authoritative signal, so German voices win even on English-default
  browsers.
- **Use:** Don't "fix" it to browser locale — that breaks German-first behavior.
- **Files:** [EN](0001-voice-language-follows-platform-locale.md) ·
  [DE](0001-voice-language-follows-platform-locale.de.md)

## ADR 0002 — Voice selection lives in a pure module, unit-tested by QUnit in CI

- **Status:** Accepted.
- **Decision:** The `selectVoice` decision is extracted into a dependency-free
  module (`javascripts/discourse/lib/tts-selection.js`) and unit-tested via
  QUnit in a Discourse container in CI; locally the same assertions run through
  Node.
- **Why:** Keeps voice selection testable without a Discourse runtime.
- **Use:** Theme tests address theme modules **without** the `javascripts/`
  prefix — an easy foot-gun when adding the next test file.
- **Files:** [EN](0002-voice-selection-as-pure-testable-module.md) ·
  [DE](0002-voice-selection-as-pure-testable-module.de.md)

## ADR 0003 — Theme component only: no backend, no dependencies, on-device TTS

- **Status:** Accepted.
- **Decision:** No server plugin, no API keys, no external TTS service, no audio
  file generation. Speech comes from the browser's Web Speech API on the
  visitor's device.
- **Why:** Protects the core value: zero setup, zero cost, zero privacy
  exposure.
- **Use:** Roadmap ideas that need a server (e.g. pre-generated MP3s with cloud
  TTS) stay out of scope by design.
- **Files:** [EN](0003-theme-component-only-no-backend.md) ·
  [DE](0003-theme-component-only-no-backend.de.md)

## ADR 0004 — Speech lifecycle: never autoplay, one active player, sentence chunking

- **Status:** Accepted.
- **Decision:** Never autoplay; only one post speaks at a time (global active-player
  lock); speech stops on navigation and on re-render/removal of a post; long
  blocks split into sentence-bounded chunks (max 250 chars); a periodic
  `resume()` keeps Chrome desktop from silently pausing long playback.
- **Why:** These are deliberate reliability decisions, not bugs.
- **Use:** Don't let a future reader "simplify" them away.
- **Files:** [EN](0004-speech-lifecycle-and-reliability-rules.md) ·
  [DE](0004-speech-lifecycle-and-reliability-rules.de.md)

## ADR 0005 — Voice settings are language codes from a drop-down, not free-text names

- **Status:** Amended by [ADR 0008](#adr-0008) (and further by
  [ADR 0009](#adr-0009)). Admin still configures only a language; the specific
  voice *within* that language is now chosen per platform from a curated
  recommended-voice index shipped by the component.
- **Decision:** `default_voice` and `fallback_voice` are `enum` drop-downs of
  BCP 47 language codes (`de`, `de-DE`, `en-US`, …​), with `auto` = "no
  preference". The player matches a setting by language — exact code first, then
  family — never by voice name. Ships a settings migration
  (`migrations/settings/0001-voice-settings-to-language-enum.js`) that keeps
  stored codes and maps names/empties to `auto`.
- **Why:** Voice names differ per browser, OS and device and change with OS
  updates, so a pinned name silently failed for most visitors. Language codes
  are universal; the device voice list is already exposed to visitors via
  `show_voice_selector`, so admins only express a language preference.
- **Use:** Pinning one exact voice was deliberately out of scope at this point;
  ADR 0008/0009 reintroduce a *curated*, platform-aware form of it.
- **Files:** [EN](0005-voice-settings-are-language-codes.md) ·
  [DE](0005-voice-settings-are-language-codes.de.md)

## ADR 0006 — Voice-selection redesign: drop fallback setting, normalize codes, notice instead of silent switch

- **Status:** Accepted. Amends [ADR 0001](#adr-0001); replaces the
  `default_voice` + `fallback_voice` two-setting model from
  [ADR 0005](#adr-0005) with a single `default_voice` setting.
- **Decision:**
  1. `fallback_voice` is **removed** (migration `0002-…`); existing installs migrate to `auto`.
  2. Every voice `lang` code is **normalized** before matching (`_` → `-`;
     strip `deu-DEU-f00`-style 3-letter prefixes). This alone fixed the customer
     complaint on desktop and iOS.
  3. `list[0]` is **never** a fallback. The ladder: user-override →
     `default_voice` → platform language (only if `default` is `auto`) →
     `navigator.languages` matched against real normalized voices → **stop and
     show the no-voice notice**.
  4. A **no-voice notice** is shown instead of silently switching language — a
     small, non-dismissible, localized inline warning; every language switch is
     the visitor's decision, never the component's.
  5. The user **override is stored as a voice identity `{lang, name}`** in
     `localStorage`, forum-wide; "Default" in the drop-down clears it (revert),
     so later admin changes are picked up automatically.
- **Why:** An Android customer received Indian (hi-IN / en-IN) voices in a
  German forum with both settings set, because the matcher compared
  `startsWith("de-")` against `de_DE` / `deu-DEU-f00` codes it couldn't see, and
  silently fell to `getVoices()[0]`.
- **Use:** One setting (`default_voice`); a new `show_no_voice_notice` setting
  (default `true`). Honest Android caveat: Chrome Android lists phantom voices,
  so the notice is best-effort on Android and fully reliable on desktop/iOS.
- **Files:** [EN](0006-voice-selection-redesign.md) ·
  [DE](0006-voice-selection-redesign.de.md)

## ADR 0007 — Speed drop-down: 0.1–2.0 in 0.1 steps, persisted, aligned to `default_rate`

- **Status:** Accepted.
- **Decision:** The speed drop-down offers 0.1 steps from 0.1× to 2.0× (20
  options), replacing the coarse 0.25-step sequence. `default_rate` is aligned to
  the same range (`min: 0.1, max: 2.0`, 0.1 steps, default `1.0`) so the admin
  default is always a real value in the drop-down. The chosen rate is **saved
  per browser in `localStorage`** with the same revert rules as the voice
  override; a mid-playback rate change restarts the current chunk at the new
  rate.
- **Why:** Visitor tests showed 0.8× is pleasant for some readers; the old
  `default_rate` range (0.5–3.0) didn't match the drop-down (capped at 2.0), so a
  2.5 default was neither shown nor reachable.
- **Use:** No new setting; `default_rate` bounds change to 0.1–2.0.
- **Files:** [EN](0007-speed-dropdown-and-persistence.md) ·
  [DE](0007-speed-dropdown-and-persistence.de.md)

## ADR 0008 — Per-platform recommended voice: a curated name preference within the resolved language

- **Status:** Accepted. Supplements [ADR 0005](#adr-0005); does not touch the
  ladder from [ADR 0006](#adr-0006).
- **Decision:** The admin still configures only a language. The component ships a
  **vendored, compact recommended-voice index** from the Readium Speech project,
  for a core set of languages in the `default_voice` enum (`de en fr es it pt
  nl`). A new pure step `preferRecommendedVoice` reorders *which voice of the
  resolved language* is chosen; it does not change which language is resolved.
  Within a language the order is: region match → `preloaded: true` → `quality`
  (`veryHigh` > `high` > `normal` > `low`) → `localService` (offline) tie-break →
  index order. Matching is case-insensitive against `name` **or** `altNames`;
  `localizedName: "apple"` is documentation-only. Platform detection is a
  best-effort `navigator`→Readium `os`/`browser` tag map, not authoritative.
- **Why:** `getVoices()` order is unspecified, so among multiple German voices
  (Anna, Hedda, Google Deutsch, …​) the auto default was effectively random,
  often the robotic one; no single voice name exists across platform families.
- **Use:** No setting, no migration. Falls back gracefully to "any voice of the
  language" (invariant I1) when no recommended name is installed; the visitor
  override always wins. Android honesty unchanged — a recommended name can match
  a phantom voice.
- **Files:** [EN](0008-per-platform-recommended-voice.md) ·
  [DE](0008-per-platform-recommended-voice.de.md)

## ADR 0009 — Admin can pin a per-platform recommended voice name from the curated index

- **Status:** Accepted. Amends [ADR 0005](#adr-0005) and
  [ADR 0008](#adr-0008); does not touch the ladder from
  [ADR 0006](#adr-0006).
- **Decision:** The admin still picks a language first (`default_voice`). Eight
  new `enum` settings pin a recommended voice **name** per platform —
  `voice_macos`, `voice_ios`, `voice_ipados`, `voice_windows`, `voice_android`,
  `voice_chromeos`, `voice_chrome_desktop`, `voice_edge` — each defaulting to
  `auto` (no pin → ADR 0008's auto choice). Values are `"<lang>: <name>"` drawn
  from the curated index; the choice blocks in `settings.yml` are generated by
  `scripts/build-voice-choices.mjs`. A pin applies only if its language family
  matches the resolved language **and** the named voice is actually installed; it
  beats 0008's auto choice but never the visitor's own override, and never
  changes which language is resolved. A new pure step
  `preferAdminPinnedVoice` runs before `preferRecommendedVoice` inside
  `pickVoiceForLang`. On multi-tag devices (iPad = iPadOS + macOS; Edge on
  Windows = Windows + Edge) the highest-priority resolving pin wins — browser
  tags over OS tags, iPadOS over macOS within Apple.
- **Why:** ADR 0008 vendored thousands of curated name lines but showed none to
  the admin; the curated index *is* the maintained per-platform name list, so
  offering it as the pin drop-down makes per-platform pinning honest, not blind.
- **Use:** No migration (all new, default `auto`); invariant I3 — without a set
  pin the ladder is byte-identical to pre-feature behavior. An index refresh now
  also regenerates the `settings.yml` choice blocks.
- **Files:** [EN](0009-admin-per-platform-voice-pin.md) ·
  [DE](0009-admin-per-platform-voice-pin.de.md)

---

## Decision timeline

| ADR | Topic | Supersedes / amends |
|---|---|---|
| 0001 | Voice language follows platform, not browser | — |
| 0002 | Pure, unit-tested selection module | — |
| 0003 | Theme component only, no backend | — |
| 0004 | Speech lifecycle & reliability rules | — |
| 0005 | Settings are language codes, not names | — |
| 0006 | Redesign: drop fallback, normalize, notice | amends 0001; replaces 0005's two-setting model |
| 0007 | Speed drop-down 0.1–2.0, persisted | — |
| 0008 | Per-platform recommended voice (curated) | supplements 0005 |
| 0009 | Admin pins per-platform voice name | amends 0005 and 0008 |

## Related research

- [`docs/research/0001-android-voice-selection-bug.md`](../research/0001-android-voice-selection-bug.md) — the Android voice bug behind ADR 0006.
- [`docs/research/0002-per-platform-voice-names.md`](../research/0002-per-platform-voice-names.md) — no voice name spans platforms; basis of ADR 0008.
- [`docs/research/0002-refresh-recommended-voices.md`](../research/0002-refresh-recommended-voices.md) — how to regenerate the vendored index (ADR 0008/0009).