# Research: Per-platform voice names and a curated recommended-voice index

**Date:** 2025-08
**Question:** Voice names differ per browser, OS and device; the automatic
default among a language's several voices is "whichever the device lists
first" (unspecified order). How can the component pick a good default voice
*within* the resolved language, per platform, without making the admin pin a
fragile voice name?

## Findings

### 1. No German voice name exists on more than one platform family

Cross-referencing Microsoft's Narrator voice appendix, Readium Speech's
`de.json`, and the platform-behavior notes, the German voices each platform
reports through `getVoices()` are disjoint:

| Platform | German voice names |
| --- | --- |
| macOS / iOS / iPadOS | `Anna` (preloaded, natural), `Helena`, `Martin`, `Petra`, `Markus`, `Viktor`, `Yannick` |
| Windows (Chrome, Firefox, Edge legacy) | `Microsoft Hedda - German (Germany)`, `Microsoft Katja - German (Germany)`, `Microsoft Stefan - German (Germany)` |
| Edge (cloud/natural, Win11) | `Microsoft Katja Online (Natural) - German (Germany)`, `Conrad`, `Florian`, `Killian`, `Amala`, `Seraphina`, `Ingrid` (AT), `Jonas` (AT), `Leni` (CH), `Jan` (CH) |
| Chrome desktop | `Google Deutsch` (one female voice, online-only, 14 s cutoff bug) |
| Chrome OS / Android | `Google Deutsch 2 (Natural)`, … `4 (Natural)` — but reported as `Android Speech Recognition and Synthesis from Google de-de-x-dea-network` etc. |

An admin who pins one name pins a voice that is absent on every other
platform. "Default name per device or browser" is the only shape that can
work.

### 2. Four platform quirks that defeat naive name matching

1. **macOS localizes voice names by system locale.** "Anna" is the name on a
   German-locale Mac; an English-locale Mac shows the same voice under a
   different name. `voiceURI` is not a reliable stable id either (most
   browsers reuse `name` for it and do not enforce uniqueness). Readium marks
   these voices `localizedName: "apple"` and the curator maintains the
   canonical `name` plus `altNames`.
2. **Edge natural voices only appear in Edge**, not in Chrome or Firefox on
   the same Windows machine, and Edge 150 has an active bug returning
   `"Microsoft undefined Online (Natural) - undefined"` for every natural
   voice. Even the correct name is currently flaky.
3. **Safari returns `default: true` for every voice** and, per one source,
   sometimes returns an empty voice list since 15.4. The system default cannot
   be detected on Safari; only explicit name matching works.
4. **Chrome Android returns an unfiltered list of language/regions**
   localized to the system locale, including voices whose packs are not
   installed. A name match can land on a phantom voice that cannot actually
   speak. Nothing name-based fixes Android — the honest caveat already in
   ADR 0006 remains.

### 3. A maintained per-platform recommended-voice dataset already exists

The Readium Speech project (`github.com/readium/speech`, successor to
`HadrienGardeur/web-speech-recommended-voices`) maintains, per language, a
curated JSON list of recommended voices. Each voice carries exactly the
fields a per-platform default needs:

- `name` — the canonical voice name.
- `altNames` — aliases (Android's `Android Speech Recognition and Synthesis
  from Google de-de-x-dea-network`-style names map to one voice).
- `localizedName: "apple"` — marks macOS/iOS voices whose display name is
  localized by system locale.
- `os` / `browser` — `macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/`ChromeOS` and
  `Edge`/`ChromeDesktop`, interpreted separately.
- `quality` (`veryHigh`/`high`/`normal`/`low`), `preloaded` (bool), `gender`.

This is the per-device default-voice map the feature needs — maintained by
someone else, handling every quirk in §2. The component vendors a compact
slice of it.

## Implications for the design

1. **The admin still configures only a language** (`default_voice`, ADR
   0005/0006). No new setting, no migration — the component ships the
   curated index and applies it internally.
2. **The preference is a layer, not a replacement.** `findForLang` is split
   into "collect all voices of this language (exact then family, deduped)"
   and "pick the best one"; the picker applies the recommended-voice
   preference and degrades to the first collected voice (today's behavior)
   when no recommended name is installed. ADR 0006's ladder is untouched.
3. **The preference applies at every language-resolved ladder step** (admin
   default, platform language, browser languages). The visitor override
   (`{lang, name}`) is name-based and unchanged; it always wins.
4. **Ranking:** `preloaded` first, then `quality` (`veryHigh` > `high` >
   `normal`), then `localService` (offline), then index order; the table's
   `defaultRegion` is preferred when the admin set a bare family code.
5. **Matching** is `device.name === recommended.name` OR `device.name` in
   `recommended.altNames`, with the Apple-localized display name also tried
   when `localizedName === "apple"`.
6. **Vendor, do not fetch.** ADR 0003 keeps the component self-contained;
   runtime fetch adds a network/privacy dependency and a failure mode.
7. **Android honesty stays.** The index is a desktop/iOS refinement, not an
   Android fix; the no-voice notice remains best-effort on Android.

## Sources

- Readium Speech — curated recommended-voice JSON per language
  https://github.com/readium/speech (e.g. `json/de.json`, `json/en.json`)
- HadrienGardeur — *web-speech-recommended-voices* (predecessor repo)
  https://github.com/HadrienGardeur/web-speech-recommended-voices
- Readium — *SpeechSynthesis in browsers and OSes* (platform-behavior notes)
  https://readium.org/speech/docs/WebSpeech.html
- Microsoft Support — *Appendix A: Supported languages and voices* (Windows)
  https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices
- Microsoft Edge Blog — *Bringing cloud powered voices to Microsoft Edge*
  https://blogs.windows.com/msedgedev/2019/08/14/cloud-powered-voices-microsoft-edge-chromium
- testmuai — *Speech Synthesis API: Browser Support, Voices, Limitations*
  https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support
- weboutloud — *The State of Speech Synthesis in Safari*
  https://weboutloud.io/bulletin/speech_synthesis_in_safari