// Pure, dependency-free voice selection for the TTS player.
//
// Kept separate from the UI code so it can be unit-tested in isolation.
// It decides which device voice to speak with, in priority order:
//   1. the configured default voice (matched by name or language)
//   2. the configured fallback voice
//   3. the first voice matching the platform's default language
//      (document.documentElement.lang — the Discourse site locale)
//   4. the first available voice on the device
// If the browser provides no voices at all, `voice` is null and the caller
// falls back to the platform language (or en-US).

/**
 * @param {Array<{ name: string, lang: string }>} voices
 *   Voices reported by `speechSynthesis.getVoices()`.
 * @param {object} options
 * @param {string} [options.defaultVoice]
 *   Setting value: a voice name or language code to prefer.
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
  const lang = String(platformLang || "").toLowerCase();

  const bySetting =
    findByName(list, defaultVoice) || findByName(list, fallbackVoice);
  if (bySetting) {
    return { voice: bySetting, lang: bySetting.lang };
  }

  const byLanguage = findForLang(list, lang);
  if (byLanguage) {
    return { voice: byLanguage, lang: byLanguage.lang };
  }

  if (list.length > 0) {
    return { voice: list[0], lang: list[0].lang };
  }

  return { voice: null, lang: platformLang || "en-US" };
}

// Substring match against the voice's name and language, case-insensitive,
// so both "Google Deutsch" and a bare "de" work as setting values.
function findByName(voices, settingValue) {
  const needle = String(settingValue || "")
    .trim()
    .toLowerCase();
  if (!needle) {
    return null;
  }
  return (
    voices.find((voice) =>
      `${voice.name} ${voice.lang}`.toLowerCase().includes(needle)
    ) || null
  );
}

// Exact language match first (e.g. "de-DE"), then language-family match
// (e.g. "de" matching "de-AT", "de-DE", …).
function findForLang(voices, lang) {
  if (!lang) {
    return null;
  }
  const family = lang.split("-")[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === lang) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(family + "-")) ||
    null
  );
}
