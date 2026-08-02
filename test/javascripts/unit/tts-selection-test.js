import { module, test } from "qunit";
import { selectVoice } from "../../../discourse/lib/tts-selection";

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
