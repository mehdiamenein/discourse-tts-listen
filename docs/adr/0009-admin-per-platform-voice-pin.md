# Admin can pin a per-platform recommended voice name from the curated index

**Status:** Accepted. Amends [ADR 0005](0005-voice-settings-are-language-codes.md)
and [ADR 0008](0008-per-platform-recommended-voice.md). Does not touch
[ADR 0006](0006-voice-selection-redesign.md)'s ladder.

## Context

ADR 0005 made voice *settings* language codes and declared pinning a specific
voice name "deliberately out of scope" because voice names differ per browser,
OS and device and change with OS updates, so a pinned name silently failed for
most visitors. ADR 0008 then shipped a vendored, per-platform recommended-voice
index and used it to *automatically* refine which voice within the resolved
language is picked — while explicitly rejecting three admin-facing options:

- **Admin free-text `default_voice_name` hint** — reintroduces the ADR 0005
  fragility (admin pins a name blind to the visitor's device).
- **Per-platform admin settings (`default_voice_name_macos`, …)** — "settings
  explosion; the admin cannot know each platform's voice names either. The
  table is the maintained form of this idea."
- **Hard pin (recommended name or no-voice notice)** — a missing recommended
  name would silence a post that has other usable voices.

The gap this leaves is real and was the reason for the present change: ADR
0008 vendored thousands of lines of curated voice *names* but exposed *none*
of them to the admin. The admin's only lever stayed the language code, and the
"which voice within the language" decision was made for them, invisibly. From
the admin's seat the whole PR changed nothing visible, and the curated names
the component already ships were never made selectable.

The one objection that made per-platform admin settings infeasible in 0008
— "the admin cannot know each platform's voice names" — is exactly what the
vendored index now removes: it *is* the maintained, per-platform list of names
that exist on each device family. Surfacing it as the admin's drop-down
choices makes the per-platform pin honest, not blind.

## Decision

1. **The admin still picks a language first** (`default_voice`), unchanged from
   ADR 0005/0006/0008. That setting governs *which language* is resolved.

2. **Eight new `enum` settings pin a recommended voice *name* per platform**,
   one per platform tag the vendored index is keyed by: `voice_macos`,
   `voice_ios`, `voice_ipados`, `voice_windows`, `voice_android`,
   `voice_chromeos`, `voice_chrome_desktop`, `voice_edge`. Each defaults to
   `auto` (no pin: the ADR 0008 automatic pick applies). A specific value is a
   voice *name* from the curated index, formatted `"<lang>: <name>"` so the
   admin can tell languages apart in one flat `enum` list — Discourse theme
   `enum` choices are static, so the list cannot be re-scoped to the chosen
   `default_voice` live.

3. **The choice lists are derived from the vendored index.**
   `scripts/build-voice-choices.mjs` regenerates the eight `choices` blocks in
   `settings.yml` from `tts-recommended-voices.js`, so the admin drop-down and
   the index a visitor is matched against stay in sync. Regenerating the
   choices is now a step in the index refresh
   (`docs/research/0002-refresh-recommended-voices.md`).

4. **A pin only takes effect when its language family matches the resolved
   language AND the named voice is actually installed** on the visitor's
   device. A pin for a language the visitor is not hearing, or for a voice the
   device lacks, is ignored — the visitor never hears the wrong language and
   never gets a silent no-op. This is the graceful-degrade option ADR 0008
   rejected, now safe because the name comes from the curated index, not the
   admin's memory.

5. **A pin wins over the ADR 0008 automatic pick, but never over the visitor's
   own override** and never changes which language is resolved or whether a
   voice was found. A new pure step `preferAdminPinnedVoice` runs before
   `preferRecommendedVoice` inside `pickVoiceForLang`; both fall back to the
   first collected voice of the language (today's behavior) when nothing
   applies.

6. **When a device carries several platform tags** (an iPad reports iPadOS
   and macOS; Edge-on-Windows reports Windows and Edge), the highest-priority
   pin that resolves wins. Browser tags (Edge, ChromeDesktop) rank above os
   tags because browser-specific voices are the higher-quality names an admin
   pins for that browser; within Apple's dual tag iPadOS outranks macOS.

## Consequences

- **ADR 0005 is amended, not reversed.** The admin *still* cannot free-text a
  voice name; pinning is restricted to names the curated index already lists,
  which closes the original fragility (a pinned name exists on its platform by
  construction) while finally giving the admin per-voice control.
- **ADR 0008's "no per-platform admin settings" rejection is reversed.** The
  settings-explosion objection is accepted as the cost of admin control; it is
  bounded (eight settings) and the choices are generated, not hand-maintained.
- **No migration.** All eight settings are new and default to `auto`; existing
  installs are unchanged (invariant I3: with no pin set, the ladder is
  byte-identical to the pre-feature behavior). This avoids the migration
  failure class that produced PR #26.
- **Snapshot maintenance grows by one step.** Refreshing the index now also
  requires regenerating `settings.yml` choices (the build script). The
  refresh-note checklist and the settings.yml header call this out.
- **Visitor drop-down unchanged.** The per-post voice selector still lists the
  visitor's own device voices grouped by language; the visitor picks from what
  their browser actually has, "like before". The admin drop-downs configure the
  *automatic default* per platform.
- **Android honesty unchanged.** Chrome Android returns an unfiltered voice
  list including voices whose packs are not installed; a pinned name can match
  a phantom voice that cannot actually speak, exactly as the ADR 0008 automatic
  pick can. The pin is a refinement, not an Android fix.

## Considered options

- **One free-text `default_voice_name` per platform.** Rejected: reintroduces
  the ADR 0005 fragility (typos, retired names) and loses the language-scope
  guard. An `enum` of curated names is both typed and language-prefixed.
- **Per-language-and-platform settings (`voice_de_macos`, …).** Rejected: 7
  languages × 8 platforms = 56 settings. The single language-family match guard
  lets one setting per platform serve all covered languages.
- **Dynamic choice lists scoped to `default_voice`.** Rejected: Discourse
  theme `enum` choices are static in `settings.yml`; there is no dependent-
  choice mechanism. The lang prefix in the value is the honest substitute, and
  the family-match guard enforces scoping at runtime.
- **Hard pin (pinned name or no-voice notice).** Rejected for the same reason
  as in 0008: a missing pinned name must not silence a post that has other
  usable voices of the language. The pin degrades to the ADR 0008 automatic
  pick, then to any voice of the language.