// Pure, dependency-free voice selection for the TTS player.
//
// Kept separate from the UI code so it can be unit-tested in isolation.
// It decides which device voice to speak with, following the selection
// ladder (ADR 0006):
//   1. userVoice — the visitor's persisted override. Match the exact
//      {lang, name} identity, then any voice of that language, then fall
//      through to the automatic ladder.
//   2. defaultVoice — the admin's configured default language (a language
//      code from the settings drop-down). Only when it is not "auto".
//   3. platformLang — the platform's default language
//      (document.documentElement.lang — the Discourse site locale). Only
//      when defaultVoice is "auto": the platform language is a guarded
//      step, never a silent second choice after a configured default.
//   4. browserLangs — navigator.languages, in order, each matched against
//      real, normalized voices. The spec-recommended visitor-preference
//      signal (Accept-Language), safe at the terminal because every admin
//      and platform option has already failed.
//   5. list[0] — TEMPORARY terminal fallback so the player still speaks
//      when nothing above matches. Removed in issue #18 in favour of the
//      no-voice notice.
// `matched` is true when a voice was selected by a matching step (1–4) and
// false when the ladder fell through to list[0] (or found no voice at all).
//
// Settings are language codes, never voice names: codes like "de-DE" are
// universal across browsers and devices, while voice names ("Google Deutsch",
// "Microsoft Katja", …) differ per browser, OS and device and change over
// time. A user's own choice persists as a {lang, name} identity and always
// wins (the player stops re-applying this ladder once one is made).

/**
 * @param {Array<{ name: string, lang: string }>} voices
 *   Voices reported by `speechSynthesis.getVoices()`.
 * @param {object} options
 * @param {{ lang: string, name: string } | null} [options.userVoice]
 *   The visitor's persisted voice identity. Matched exactly, then by
 *   language, then falls through. `null` means no override.
 * @param {string} [options.defaultVoice]
 *   Setting value: a language code to prefer; "" or "auto" means none.
 * @param {string} [options.platformLang]
 *   The platform's default language, e.g. "de" or "de-DE".
 * @param {string[]} [options.browserLangs]
 *   `navigator.languages`, in preference order.
 * @returns {{ voice: ({ name: string, lang: string } | null), lang: string, matched: boolean }}
 *   The chosen voice (or null), the language to speak with, and whether a
 *   configured preference actually matched.
 */
export function selectVoice(
  voices,
  {
    userVoice = null,
    defaultVoice = "auto",
    platformLang = "",
    browserLangs = [],
  } = {}
) {
  const list = Array.isArray(voices) ? voices : [];
  const browsers = Array.isArray(browserLangs)
    ? browserLangs.filter(Boolean)
    : [];

  // 1. User override: exact identity, then any voice of that language, then
  //    fall through to the automatic ladder below.
  if (userVoice) {
    const userLang = normalizeLang(userVoice.lang);
    const exact =
      userLang &&
      list.find(
        (voice) =>
          normalizeLang(voice.lang) === userLang &&
          voice.name === userVoice.name
      );
    if (exact) {
      return { voice: exact, lang: exact.lang, matched: true };
    }
    const sameLang = findForLang(list, userVoice.lang);
    if (sameLang) {
      return { voice: sameLang, lang: sameLang.lang, matched: true };
    }
  }

  // 2. Admin default language — only when it is not "auto". "auto" (and an
  //    empty setting) means "no admin preference": skip straight to the
  //    platform language.
  const defaultIsAuto = isAutoValue(defaultVoice);
  if (!defaultIsAuto) {
    const byDefault = findForLang(list, defaultVoice);
    if (byDefault) {
      return { voice: byDefault, lang: byDefault.lang, matched: true };
    }
  }

  // 3. Platform language — only when the admin default is "auto". This is
  //    the auto-gates-platform rule: a configured default that has no voice
  //    never silently swaps to the platform's language; it falls through to
  //    the browser languages instead.
  if (defaultIsAuto) {
    const byPlatform = findForLang(list, platformLang);
    if (byPlatform) {
      return { voice: byPlatform, lang: byPlatform.lang, matched: true };
    }
  }

  // 4. Browser languages, in preference order.
  for (const browserLang of browsers) {
    const byBrowser = findForLang(list, browserLang);
    if (byBrowser) {
      return { voice: byBrowser, lang: byBrowser.lang, matched: true };
    }
  }

  // 5. TEMPORARY terminal fallback (removed in issue #18). When nothing above
  //    matched, speak with the first device voice so the player still works;
  //    `matched: false` tells a future notice that this was an unmatched
  //    pick, not a configured preference.
  if (list.length > 0) {
    return { voice: list[0], lang: list[0].lang, matched: false };
  }

  return { voice: null, lang: platformLang || "en-US", matched: false };
}

// An admin setting of "auto" (or empty) means "no preference": the platform
// language step is unlocked and the configured-default step is skipped.
// Normalized so case and stray whitespace never make "Auto" or "  " behave
// like a real language code.
function isAutoValue(value) {
  const normalized = normalizeLang(value);
  return normalized === "" || normalized === "auto";
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
