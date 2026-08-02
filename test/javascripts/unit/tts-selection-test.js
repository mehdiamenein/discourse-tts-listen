import { module, test } from "qunit";
import { selectVoice } from "../../../discourse/lib/tts-selection";

const VOICES = [
  { name: "Google US English", lang: "en-US" },
  { name: "Google Deutsch", lang: "de-DE" },
  { name: "Microsoft Katja", lang: "de-DE" },
  { name: "Google français", lang: "fr-FR" },
];

module("TTS Listen | Unit | selectVoice", function () {
  test("uses the configured default voice when it is available", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "deutsch" });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
  });

  test("matches the default voice case-insensitively", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "DEUTSCH" });

    assert.strictEqual(result.voice, VOICES[1]);
  });

  test("accepts a bare language code as the default voice", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "de" });

    assert.strictEqual(result.voice, VOICES[1]);
  });

  test("falls back to the fallback voice when the default has no match", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "Aussie Larry",
      fallbackVoice: "katja",
    });

    assert.strictEqual(result.voice, VOICES[2]);
    assert.strictEqual(result.lang, "de-DE");
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
