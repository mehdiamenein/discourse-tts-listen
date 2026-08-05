# Research: Android / cross-device voice selection bug

**Date:** 2025-08
**Question:** Why did a customer on Android receive Indian (hi-IN / en-IN) TTS
voices by default despite the admin configuring German — and what is a
universally acceptable fix?

## Findings

### 1. Chrome on Android returns an *unfiltered* voice list

`speechSynthesis.getVoices()` on Chrome Android returns an unfiltered list of
language/regions, including ones whose voice packs are **not installed** on the
device. Picking any entry from this list — especially the first — can land on a
voice that is not actually usable, or on an Indian-English / Hindi voice that
happens to be listed first.

> "Chrome on Android doesn't return the list of voices available to the users,
> instead it returns an unfiltered list of languages/regions." — Readium

> "Android isn't exactly honest about the voices that you can use at any one
> time. `SpeechSynthesis.getVoices()` will return several options for English
> (United States, Australia, Nigeria, India, and United Kingdom) but only one is
> available at a time." — talkrapp

### 2. Voice `lang` codes are not consistently hyphenated

| Engine / browser        | Example code      |
| ---------------------- | ----------------- |
| Chrome desktop / Edge  | `de-DE`, `en-US`  |
| Chrome Android / Samsung | `de_DE`, `en_GB` (underscore) |
| Firefox (incl. Android) | `deu-DEU-f00`, `eng-GBR-f00` (three-letter) |

The current matcher in `tts-selection.js` matches with
`voice.lang.toLowerCase().startsWith(family + "-")`. A German voice reported as
`de_DE` (Android) or `deu-DEU-f00` (Firefox) therefore **never matches** a
`default_voice: de` setting. The admin's configured language silently fails to
resolve, the selection ladder falls through every step, and the code reaches the
terminal `list[0]` fallback — which on Android is frequently an Indian voice.

This is almost certainly the customer's actual root cause: the admin setting was
correct; the matcher simply could not see the installed German voice.

### 3. `voice.default` and `list[0]` are unreliable terminal fallbacks

- `voice.default` is meant to mark the default voice for the app language, but is
  inconsistent across implementations (Readium: "really hard to use due to
  inconsistencies across implementations, limited context …").
- The order of `getVoices()` is unspecified; `list[0]` is non-deterministic and
  Android-skewed. Using it as a terminal fallback is the direct cause of the
  Indian-voice complaint.

### 4. The spec-recommended "what does the visitor want?" signal

Readium recommends using the `Accept-Language` HTTP header, equivalent to
`navigator.languages`, as an ordered list of preferred languages — matched
against the real voice list. This is a refinement for choosing among available
voices, **not** a substitute for a robust admin-configured default.

## Implications for the design

1. **Normalize voice `lang` codes before matching**: replace `_` with `-`, and
   strip three-letter Firefox prefixes (e.g. `deu-DEU-f00` → `de-DE`). This alone
   likely fixes the customer complaint.
2. **Never use `list[0]` as a terminal fallback.** It is the bug source on
   Android.
3. **`fallback_voice` is not redundant with `default_voice`.** It is the escape
   hatch for the case where the device genuinely has no voice for the preferred
   language (the voice pack is not installed). Without it, the only remaining
   fallback is the non-deterministic `list[0]` → Indian voice recurs.
4. `navigator.languages` may be added as a guarded step (matched against real,
   normalized voices) but is secondary to fixes 1–3.

## Sources

- talkrapp — *Lessons Learned Using the javascript speechSynthesis API*
  https://talkrapp.com/speechSynthesis.html
- Readium — *SpeechSynthesis in browsers and OSes*
  https://readium.org/speech/docs/WebSpeech.html
- MDN — *SpeechSynthesis: getVoices() method*
  https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- jankapunkt — *Cross browser speech synthesis - the hard way and the easy way*
  https://dev.to/jankapunkt/cross-browser-speech-synthesis-the-hard-way-and-the-easy-way-353