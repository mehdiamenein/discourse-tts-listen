// Pure voice selection for the TTS player.
//
// Kept separate from the UI code so it can be unit-tested in isolation.
// It decides which device voice to speak with, following the selection
// ladder (ADR 0006), with a per-platform recommended-voice preference
// layered within the resolved language (ADR 0008). The admin still
// configures only a language; the recommended-voice index is shipped by the
// component and refines WHICH voice of that language is picked — it never
// changes which language is resolved.
//
// The ladder is:
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
//   5. No voice. When nothing above matches, the ladder returns
//      {voice: null, matched: false} with the configured language it was
//      trying to satisfy; the player renders the no-voice notice (issue
//      #18) instead of silently switching to list[0].
// `matched` is true when a voice was selected by a matching step (1–4) and
// false when the ladder found no voice at all — never list[0], which is
// an unreliable, unspecified terminal fallback (ADR 0006).
//
// At every language-resolved step the picker applies preferRecommendedVoice
// (ADR 0008) before falling back to the first collected voice of the
// language (today's behavior). The two regression invariants hold by
// construction: I1 — with no recommendation resolving, the picker returns
// exactly what the old findForLang returned; I2 — adding the index never
// changes `matched`, only which voice.
//
// Settings are language codes, never voice names: codes like "de-DE" are
// universal across browsers and devices, while voice names ("Google Deutsch",
// "Microsoft Katja", …) differ per browser, OS and device and change over
// time. A user's own choice persists as a {lang, name} identity and always
// wins (the player stops re-applying this ladder once one is made).

import { preferRecommendedVoice } from "./tts-recommended-voices";

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
 * @param {object} [options.recommended]
 *   The vendored recommended-voice index (ADR 0008). `null`/`{}` means no
 *   recommendation: the picker falls back to any voice of the language.
 * @param {{ os?: string[], browser?: string[] }} [options.platform]
 *   The detected platform tags (ADR 0008), used to filter the index.
 * @returns {{ voice: ({ name: string, lang: string } | null), lang: string, matched: boolean }}
 *   The chosen voice (or null when nothing matches), the language to speak
 *   with (the configured preference the device could not satisfy when no
 *   voice matches), and whether a configured preference actually matched.
 */
export function selectVoice(
  voices,
  {
    userVoice = null,
    defaultVoice = "auto",
    platformLang = "",
    browserLangs = [],
    recommended = {},
    platform = { os: [], browser: [] },
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
    const sameLang = pickVoiceForLang(list, userVoice.lang, {
      recommended,
      platform,
    });
    if (sameLang) {
      return { voice: sameLang, lang: sameLang.lang, matched: true };
    }
  }

  // 2. Admin default language — only when it is not "auto". "auto" (and an
  //    empty setting) means "no admin preference": skip straight to the
  //    platform language.
  const defaultIsAuto = isAutoValue(defaultVoice);
  if (!defaultIsAuto) {
    const byDefault = pickVoiceForLang(list, defaultVoice, {
      recommended,
      platform,
    });
    if (byDefault) {
      return { voice: byDefault, lang: byDefault.lang, matched: true };
    }
  }

  // 3. Platform language — only when the admin default is "auto". This is
  //    the auto-gates-platform rule: a configured default that has no voice
  //    never silently swaps to the platform's language; it falls through to
  //    the browser languages instead.
  if (defaultIsAuto) {
    const byPlatform = pickVoiceForLang(list, platformLang, {
      recommended,
      platform,
    });
    if (byPlatform) {
      return { voice: byPlatform, lang: byPlatform.lang, matched: true };
    }
  }

  // 4. Browser languages, in preference order.
  for (const browserLang of browsers) {
    const byBrowser = pickVoiceForLang(list, browserLang, {
      recommended,
      platform,
    });
    if (byBrowser) {
      return { voice: byBrowser, lang: byBrowser.lang, matched: true };
    }
  }

  // 5. No voice. list[0] is deliberately not used as a terminal fallback:
  //    its order and value are unspecified or inconsistent across
  //    implementations (ADR 0006), so the player shows the no-voice notice
  //    instead of silently speaking the wrong language. The returned
  //    `lang` is the configured preference the device could not satisfy —
  //    the visitor's own override, then the admin's default, then the
  //    platform language — so the notice can name exactly what is missing.
  const intendedLang =
    (userVoice && userVoice.lang) ||
    (!defaultIsAuto ? defaultVoice : "") ||
    platformLang;
  return { voice: null, lang: intendedLang || "en-US", matched: false };
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

// Collect every device voice for a language code: exact-normalized matches
// first (e.g. "de-DE"), then language-family matches (e.g. "de" matching
// "de-AT", "de-DE", …), deduped by reference so a voice that matches exactly
// is not also listed under the family step. Pure and exported so the
// collector and the recommended-voice picker can be unit-tested in
// isolation. The needle and each voice lang are normalized first, so
// Android underscore locales and Firefox three-letter primaries resolve to
// the same codes.
//
// @param {Array<{ name: string, lang: string }>} voices
// @returns {Array<{ name: string, lang: string }>}
export function collectForLang(voices, lang) {
  const list = Array.isArray(voices) ? voices : [];
  const needle = normalizeLang(lang);
  if (!needle) {
    return [];
  }
  const family = needle.split("-")[0];
  const exact = list.filter((voice) => normalizeLang(voice.lang) === needle);
  const exactSet = new Set(exact);
  const byFamily = list.filter(
    (voice) =>
      !exactSet.has(voice) &&
      normalizeLang(voice.lang).startsWith(family + "-")
  );
  return [...exact, ...byFamily];
}

// Pick the best device voice for a language code (ADR 0006 language
// resolution, refined by the ADR 0008 recommended-voice preference). First
// prefer a recommended voice for the visitor's platform within the resolved
// language; when none is installed, fall back to the first collected voice —
// exactly what the old findForLang returned (invariant I1). Returns null when
// no voice of the language exists at all.
//
// @param {Array<{ name: string, lang: string }>} voices
// @param {string} lang
// @param {{ recommended?: object, platform?: { os?: string[], browser?: string[] } }} [ctx]
// @returns {{ name: string, lang: string } | null}
export function pickVoiceForLang(
  voices,
  lang,
  { recommended = {}, platform = { os: [], browser: [] } } = {}
) {
  const collected = collectForLang(voices, lang);
  if (collected.length === 0) {
    return null;
  }
  return (
    preferRecommendedVoice(collected, lang, { recommended, platform }) ||
    collected[0] ||
    null
  );
}

// Group device voices by their normalized language, returning one entry
// per distinct language in alphabetical order. The group's `lang` is the
// normalized key every voice in it shares; each voice keeps its original
// `lang` (so de-DE and de_DE that normalize together still show their
// reported code in the drop-down). Duplicate voices — same name within a
// language group — are dropped so the drop-down never lists a voice twice.
//
// Pure and dependency-free so the grouping, ordering and de-dup can be
// unit-tested without a DOM; the player turns the result into <optgroup>s.
//
// @param {Array<{ name: string, lang: string }>} voices
// @returns {Array<{ lang: string, voices: Array<{ name: string, lang: string }> }>}
export function groupVoicesByLang(voices) {
  const list = Array.isArray(voices) ? voices : [];
  const groups = new Map();
  for (const voice of list) {
    const lang = normalizeLang(voice.lang);
    let groupVoices = groups.get(lang);
    if (!groupVoices) {
      groupVoices = [];
      groups.set(lang, groupVoices);
    }
    // Within a language group, a duplicate is a voice of the same name.
    const isDuplicate = groupVoices.some((v) => v.name === voice.name);
    if (!isDuplicate) {
      groupVoices.push(voice);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([lang, groupVoices]) => ({ lang, voices: groupVoices }));
}
