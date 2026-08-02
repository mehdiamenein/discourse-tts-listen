// Pure, dependency-free voice selection for the TTS player.
//
// Kept separate from the UI code so it can be unit-tested in isolation.
// It decides which device voice to speak with, in priority order:
//   1. the configured default language (a language code from the settings
//      drop-down, matched by exact code then language family)
//   2. the configured fallback language
//   3. the first voice matching the platform's default language
//      (document.documentElement.lang — the Discourse site locale)
//   4. the first available voice on the device
// If the browser provides no voices at all, `voice` is null and the caller
// falls back to the platform language (or en-US).
//
// Settings are language codes, never voice names: codes like "de-DE" are
// universal across browsers and devices, while voice names ("Google Deutsch",
// "Microsoft Katja", …) differ per browser, OS and device and change over
// time. A user's own choice from the on-device voice list always wins anyway
// (the player stops re-applying this ladder once one is made).

/**
 * @param {Array<{ name: string, lang: string }>} voices
 *   Voices reported by `speechSynthesis.getVoices()`.
 * @param {object} options
 * @param {string} [options.defaultVoice]
 *   Setting value: a language code to prefer; "" or "auto" means none.
 * @param {string} [options.fallbackVoice]
 *   Setting value used when `defaultVoice` has no match.
 * @param {string} [options.platformLang]
 *   The platform's default language, e.g. "de" or "de-DE".
 * @returns {{ voice: ({ name: string, lang: string } | null), lang: string }}
 *   The chosen voice (or null) and the language to speak with.
 */
export function selectVoice(
  voices,
  { defaultVoice = "", fallbackVoice = "", platformLang = "" } = {}
) {
  const list = Array.isArray(voices) ? voices : [];

  const bySetting =
    findForLang(list, defaultVoice) || findForLang(list, fallbackVoice);
  if (bySetting) {
    return { voice: bySetting, lang: bySetting.lang };
  }

  const byLanguage = findForLang(list, platformLang);
  if (byLanguage) {
    return { voice: byLanguage, lang: byLanguage.lang };
  }

  if (list.length > 0) {
    return { voice: list[0], lang: list[0].lang };
  }

  return { voice: null, lang: platformLang || "en-US" };
}

// Language-code match: exact language first (e.g. "de-DE"), then
// language-family match (e.g. "de" matching "de-AT", "de-DE", …). Used for
// both the settings drop-down values and the platform language — codes are
// the only voice attribute that is stable across browsers and devices.
function findForLang(voices, lang) {
  const needle = String(lang || "")
    .trim()
    .toLowerCase();
  if (!needle) {
    return null;
  }
  const family = needle.split("-")[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === needle) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(family + "-")) ||
    null
  );
}
