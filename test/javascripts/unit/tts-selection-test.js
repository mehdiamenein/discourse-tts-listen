import { module, test } from "qunit";
import {
  normalizeLang,
  selectVoice,
} from "../../../discourse/lib/tts-selection";

const VOICES = [
  { name: "Google US English", lang: "en-US" },
  { name: "Google Deutsch", lang: "de-DE" },
  { name: "Microsoft Katja", lang: "de-DE" },
  { name: "Google français", lang: "fr-FR" },
];

module("TTS Listen | Unit | selectVoice", function () {
  test("selects a voice speaking the exact language code from the drop-down", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "de-DE" });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
  });

  test("a primary-subtag code from the drop-down matches regional voices", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "de" });

    assert.strictEqual(result.voice, VOICES[1]);
  });

  test("matches drop-down codes case-insensitively", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "DE" });

    assert.strictEqual(result.voice, VOICES[1]);
  });

  test("prefers the exact regional code over a regional variant", function (assert) {
    const mixed = [
      { name: "Austrian", lang: "de-AT" },
      { name: "German", lang: "de-DE" },
    ];
    const result = selectVoice(mixed, { defaultVoice: "de-DE" });

    assert.strictEqual(result.voice, mixed[1]);
  });

  test("falls back to the fallback language when the default has no matching voice", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "pt",
      fallbackVoice: "de",
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
  });

  // Regression guard: the drop-down values are language codes, so they must
  // be matched against the voice's *language*, never fuzzy-matched against
  // its name (a bare "hi" would otherwise match "This is a test voice").
  test("does not match drop-down codes against voice names", function (assert) {
    const voices = [
      { name: "This is a test voice", lang: "en-US" },
      { name: "Google Hindi", lang: "hi-IN" },
    ];
    const result = selectVoice(voices, { defaultVoice: "hi" });

    assert.strictEqual(result.voice, voices[1]);
    assert.strictEqual(result.lang, "hi-IN");
  });

  test("treats the auto (no-preference) drop-down value as no preference", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "auto",
      fallbackVoice: "auto",
      platformLang: "fr",
    });

    assert.strictEqual(result.voice, VOICES[3]);
  });

  test("prefers the platform language when no voice is configured", function (assert) {
    const result = selectVoice(VOICES, { platformLang: "de" });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
  });

  test("matches the platform language exactly before a prefix match", function (assert) {
    const mixed = [
      { name: "Austrian", lang: "de-AT" },
      { name: "German", lang: "de-DE" },
    ];
    const result = selectVoice(mixed, { platformLang: "de-DE" });

    assert.strictEqual(result.voice, mixed[1]);
  });

  test("falls back to the first device voice when the platform language is unavailable", function (assert) {
    const result = selectVoice(VOICES, { platformLang: "nl" });

    assert.strictEqual(result.voice, VOICES[0]);
    assert.strictEqual(result.lang, "en-US");
  });

  test("returns no voice and keeps the platform language when no voices exist", function (assert) {
    const result = selectVoice([], { platformLang: "de" });

    assert.strictEqual(result.voice, null);
    assert.strictEqual(result.lang, "de");
  });

  test("defaults the language to en-US when nothing matches at all", function (assert) {
    const result = selectVoice([], {});

    assert.strictEqual(result.voice, null);
    assert.strictEqual(result.lang, "en-US");
  });

  test("ignores empty voice settings and falls through to language matching", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "",
      fallbackVoice: "",
      platformLang: "fr",
    });

    assert.strictEqual(result.voice, VOICES[3]);
  });
});

module("TTS Listen | Unit | normalizeLang", function () {
  test("lowercases and converts underscores to hyphens", function (assert) {
    assert.strictEqual(normalizeLang("de_DE"), "de-de");
    assert.strictEqual(normalizeLang("EN_us"), "en-us");
  });

  test("maps Firefox three-letter primaries to the two-letter drop-down codes", function (assert) {
    assert.strictEqual(normalizeLang("deu"), "de");
    assert.strictEqual(normalizeLang("eng-GBR"), "en-gbr");
    assert.strictEqual(normalizeLang("deu-DEU-f00"), "de-deu-f00");
  });

  test("leaves an already-two-letter code untouched (no false rewrite)", function (assert) {
    assert.strictEqual(normalizeLang("en-GB"), "en-gb");
    assert.strictEqual(normalizeLang("de"), "de");
    assert.strictEqual(normalizeLang("de-DE"), "de-de");
  });

  test("returns an empty string for empty or missing input", function (assert) {
    assert.strictEqual(normalizeLang(""), "");
    assert.strictEqual(normalizeLang(undefined), "");
    assert.strictEqual(normalizeLang(null), "");
  });
});

module("TTS Listen | Unit | selectVoice | lang normalization", function () {
  // Android reports locales with underscores (de_DE); the matcher used to
  // compare against hyphenated codes only and silently missed them.
  test("matches an Android underscore locale against a primary drop-down code", function (assert) {
    const voices = [{ name: "Android German", lang: "de_DE" }];
    const result = selectVoice(voices, { defaultVoice: "de" });

    assert.strictEqual(result.voice, voices[0]);
    assert.strictEqual(result.lang, "de_DE");
  });

  // Firefox reports three-letter primaries (deu-DEU-f00); previously these
  // never matched a configured de-DE.
  test("matches a Firefox three-letter primary voice against a regional drop-down code", function (assert) {
    const voices = [{ name: "Firefox German", lang: "deu-DEU-f00" }];
    const result = selectVoice(voices, { defaultVoice: "de-DE" });

    assert.strictEqual(result.voice, voices[0]);
    assert.strictEqual(result.lang, "deu-DEU-f00");
  });

  test("still matches a primary code against a regional voice (family match)", function (assert) {
    const voices = [{ name: "Austrian", lang: "de-AT" }];
    const result = selectVoice(voices, { defaultVoice: "de" });

    assert.strictEqual(result.voice, voices[0]);
  });

  test("normalization is case-insensitive on both sides", function (assert) {
    const voices = [{ name: "Firefox German", lang: "DEU-deu-F00" }];
    const result = selectVoice(voices, { defaultVoice: "DE" });

    assert.strictEqual(result.voice, voices[0]);
  });

  // Regression guard: a fully-specified two-letter regional code must stay
  // exact; normalization must never drop or rewrite the region. en-US is
  // listed first so a wrong rewrite to the "en" family would pick it.
  test("does not rewrite a fully-specified regional code to its family", function (assert) {
    const voices = [
      { name: "American", lang: "en-US" },
      { name: "British", lang: "en-GB" },
    ];
    const result = selectVoice(voices, { defaultVoice: "en-GB" });

    assert.strictEqual(result.voice, voices[1]);
    assert.strictEqual(result.lang, "en-GB");
  });
});
