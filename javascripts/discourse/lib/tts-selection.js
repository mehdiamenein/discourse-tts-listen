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

// Map Firefox's ISO 639-2 three-letter primary subtags to the two-letter
// codes used in the settings drop-down, so a voice reported as
// "deu-DEU-f00" is matched against a configured "de-DE". Both the
// terminologic (T) and bibliographic (B) variants are listed where they
// differ, since Firefox is not consistent. Only the *primary* subtag is
// mapped; the region and any variant are left intact — matching is the job
// of findForLang, and a normalized code never carries less information than
// the original.
const PRIMARY_TO_TWO_LETTER = {
  // Germanic
  deu: "de",
  eng: "en",
  nld: "nl",
  dut: "nl",
  swe: "sv",
  dan: "da",
  nob: "nb",
  fin: "fi",
  // Romance
  fra: "fr",
  fre: "fr",
  spa: "es",
  ita: "it",
  por: "pt",
  cat: "ca",
  glg: "gl",
  eus: "eu",
  baq: "eu",
  // Slavic
  rus: "ru",
  pol: "pl",
  bul: "bg",
  hrv: "hr",
  slk: "sk",
  slo: "sk",
  slv: "sl",
  srp: "sr",
  ces: "cs",
  cze: "cs",
  ukr: "uk",
  // Other European
  hun: "hu",
  ron: "ro",
  rum: "ro",
  ell: "el",
  gre: "el",
  tur: "tr",
  est: "et",
  lit: "lt",
  lav: "lv",
  sqi: "sq",
  alb: "sq",
  // Non-Latin scripts
  heb: "he",
  ara: "ar",
  hin: "hi",
  urd: "ur",
  fas: "fa",
  per: "fa",
  tha: "th",
  // Asian & others
  vie: "vi",
  ind: "id",
  msa: "ms",
  may: "ms",
  jpn: "ja",
  kor: "ko",
  zho: "zh",
  chi: "zh",
  swa: "sw",
};

// Normalize a voice or setting language code for matching: lower-case it,
// turn Android's underscores into hyphens, and map Firefox's three-letter
// primary to the two-letter drop-down code. Empty/missing input normalizes
// to an empty string so findForLang can short-circuit on it.
export function normalizeLang(code) {
  const normalized = String(code || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("-");
  const mappedPrimary = PRIMARY_TO_TWO_LETTER[parts[0]];
  if (mappedPrimary) {
    parts[0] = mappedPrimary;
  }
  return parts.join("-");
}

// Language-code match: exact language first (e.g. "de-DE"), then
// language-family match (e.g. "de" matching "de-AT", "de-DE", …). Used for
// both the settings drop-down values and the platform language — codes are
// the only voice attribute that is stable across browsers and devices. Both
// the needle and each voice lang are normalized first, so Android underscore
// locales and Firefox three-letter primaries resolve to the same codes.
function findForLang(voices, lang) {
  const needle = normalizeLang(lang);
  if (!needle) {
    return null;
  }
  const family = needle.split("-")[0];
  return (
    voices.find((voice) => normalizeLang(voice.lang) === needle) ||
    voices.find((voice) =>
      normalizeLang(voice.lang).startsWith(family + "-")
    ) ||
    null
  );
}
