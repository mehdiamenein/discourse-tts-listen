# Per-platform recommended voice: ship a curated name preference within the resolved language

**Status:** Accepted. Amends [ADR 0005](0005-voice-settings-are-language-codes.md).
Does not touch [ADR 0006](0006-voice-selection-redesign.md)'s ladder.

## Context

ADR 0005 made voice *settings* language codes and declared pinning a specific
voice name "deliberately out of scope" because voice names differ per browser,
OS and device and change with OS updates. The visitor can still pick a
specific voice in the drop-down (persisted as a `{lang, name}` identity, ADR
0006), but the *automatic* default — the voice used when the visitor has not
chosen — is "whichever device voice the resolved language matches first",
i.e. the first entry of `getVoices()` for that language. That order is
unspecified by the spec and differs per browser, so among the several German
voices a device lists (Anna, Hedda, Google Deutsch, …) the automatic default
is effectively random and frequently the robotic one.

Research (see `docs/research/0002-per-platform-voice-names.md`) confirms there
is no voice name that exists on more than one platform family: "Anna" is
Apple only, "Microsoft Hedda - German (Germany)" is Windows only, "Google
Deutsch" is Chrome desktop only, and Android reports voices under names like
`Android Speech Recognition and Synthesis from Google de-de-x-dea-network`. An
admin who pins one name pins a voice that is absent on every other platform.

The same research found that the Readium Speech project
(`github.com/readium/speech`, successor to `HadrienGardeur/web-speech-recommended-voices`)
maintains, per language, a curated list of recommended voices carrying exactly
the fields a per-platform default needs: `name`, `altNames` (Android aliases),
`localizedName: "apple"` (macOS localizes voice names by system locale),
`os`, `browser`, `quality`, `preloaded`. This is a maintained per-device
default-voice map.

## Decision

1. **The admin still configures only a language** (`default_voice`), as in
   ADR 0005/0006. No new setting is added; no setting is removed; no
   migration is needed.
2. **The component ships a vendored, compact recommended-voices index**
   derived from Readium Speech, covering a core set of the `default_voice`
   enum languages (`de en fr es it pt nl`). Languages not in the index
   degrade gracefully to today's behavior (any voice of the language,
   invariant I1); the set can be expanded later. Each entry is `{name,
   altNames, localizedName, os, browser, quality, preloaded}`; verbose
   fields (`testUtterance`, `pitch`, `rate`, `note`) are dropped. A refresh
   note (`docs/research/0002-refresh-recommended-voices.md`) documents how
   to regenerate the index.
3. **A new pure step `preferRecommendedVoice` reorders which voice of the
   resolved language is picked**; it does not change which language is
   resolved. `findForLang` is split into "collect all voices of this language
   (exact then family, deduped)" and "pick the best one"; the picker applies
   the recommended-voice preference and falls back to the first collected
   voice (today's behavior) when no recommended name is installed.
4. **The preference applies at every language-resolved ladder step** — admin
   default, platform language, browser languages — because all of them
   resolve "a voice for language X". The visitor override (`{lang, name}`
   identity) is name-based and unchanged; it always wins.
5. **Ranking within a language:** region match first (the requested
   region, or the table's `defaultRegion` when the admin set a bare family
   code, e.g. `de` → prefer `de-DE` voices), then `preloaded: true`, then
   `quality` (`veryHigh` > `high` > `normal` > `low`), then `localService`
   (offline) to break ties, then first by index order.
6. **Matching survives platform quirks:** a recommended voice matches a
   device voice when the device voice's `name` equals the recommended `name`
   **or** any `altNames`, compared case-insensitively to tolerate vendor
   case drift (e.g. `"Google Deutsch"` vs `"Google deutsch"`).
   `localizedName: "apple"` is a documentation-only marker: the picker
   matches on the canonical `name`, which current Apple voices report
   unchanged regardless of system locale; no localized-name lookup is
   performed.
7. **Platform detection** is a crude `navigator`-based mapping to Readium's
   `os`/`browser` tags (`macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/`ChromeOS`,
   `Edge`/`ChromeDesktop`). It is a best-effort filter, not authoritative; a
   recommended voice with no `os`/`browser` is considered available
   everywhere.

## Consequences

- **ADR 0005 is amended, not reversed.** The admin does not pin a voice name
  (still out of scope); the *component* pins a curated, per-platform name
  preference from a maintained table. ADR 0006's ladder, the auto-gates-
  platform rule, and the no-voice notice are untouched.
- **No setting, no migration.** No `settings.yml`, locale, or migration
  change. This avoids the migration failure class that produced PR #26.
- **Android honesty unchanged.** Chrome Android returns an *unfiltered*
  voice list including voices whose packs are not installed; a recommended
  name can match a phantom voice that cannot actually speak. The no-voice
  notice remains best-effort on Android, as in ADR 0006. The recommended-
  voice preference is a refinement for desktop and iOS, not an Android fix.
- **Snapshot maintenance.** The vendored index is a snapshot that rots as
  Apple/Google/Microsoft ship voices. The refresh note
  (`docs/research/0002-refresh-recommended-voices.md`) and a release-
  checklist item document regeneration; regenerated snapshots must stay
  lean (only the kept fields), since the index ships to every visitor
  (ADR 0003), and compact so review is tractable.
- **Visitor override still wins.** A visitor who picks a voice in the
  drop-down is never overridden by the recommended-voice preference.

## Considered options

- **Admin free-text `default_voice_name` hint, graceful degrade.** Rejected:
  re-introduces the ADR 0005 fragility (admin pins a name blind to the
  visitor's device), and the admin cannot maintain Apple locale-variant
  names or Android aliases. The curated table handles both.
- **Runtime fetch of Readium JSON.** Rejected: violates the self-contained
  theme-component principle (ADR 0003), adds a network/privacy dependency and
  a failure mode on every page load.
- **Per-platform admin settings (`default_voice_name_macos`, …).** Rejected:
  settings explosion; the admin cannot know each platform's voice names
  either. The table is the maintained form of this idea.
- **Hard pin (recommended name or no-voice notice).** Rejected: a missing
  recommended name would silence a post that has other usable voices of the
  language. The preference degrades to "any voice of the language" instead.