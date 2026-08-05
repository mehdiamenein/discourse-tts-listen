import { module, test } from "qunit";
import {
  groupVoicesByLang,
  normalizeLang,
  selectVoice,
} from "../../../discourse/lib/tts-selection";

const VOICES = [
  { name: "Google US English", lang: "en-US" },
  { name: "Google Deutsch", lang: "de-DE" },
  { name: "Microsoft Katja", lang: "de-DE" },
  { name: "Google français", lang: "fr-FR" },
];

module("TTS Listen | Unit | selectVoice | user override", function () {
  test("matches the persisted user voice by exact {lang, name} identity", function (assert) {
    const result = selectVoice(VOICES, {
      userVoice: { lang: "de-DE", name: "Microsoft Katja" },
      defaultVoice: "en-US",
    });

    assert.strictEqual(result.voice, VOICES[2]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
  });

  test("the exact identity is matched even when a different voice speaks the same language", function (assert) {
    const result = selectVoice(VOICES, {
      userVoice: { lang: "de-DE", name: "Google Deutsch" },
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.true(result.matched);
  });

  test("falls back to any voice of the override language when the exact name is gone", function (assert) {
    // The persisted voice ("Google Deutsch") was uninstalled; another German
    // voice is still available and should be picked before the automatic
    // ladder runs.
    const result = selectVoice(VOICES, {
      userVoice: { lang: "de-DE", name: "Google Deutsch (removed)" },
      defaultVoice: "en-US",
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
  });

  test("falls through to the automatic ladder when no voice of the override language exists", function (assert) {
    const result = selectVoice(VOICES, {
      userVoice: { lang: "ja-JP", name: "Google Japanese (removed)" },
      defaultVoice: "de-DE",
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
  });

  test("a null user override is no override — the automatic ladder runs", function (assert) {
    const result = selectVoice(VOICES, {
      userVoice: null,
      defaultVoice: "de-DE",
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.true(result.matched);
  });
});

module("TTS Listen | Unit | selectVoice | default voice", function () {
  test("selects a voice speaking the exact language code from the drop-down", function (assert) {
    const result = selectVoice(VOICES, { defaultVoice: "de-DE" });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
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
    assert.true(result.matched);
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
});

module(
  "TTS Listen | Unit | selectVoice | auto-gates-platform rule",
  function () {
    // The platform language is a guarded step, never a silent second choice
    // after a configured default. When the admin sets a default that has no
    // matching voice, the ladder must NOT swap to the platform language: it
    // falls through to the browser languages instead.
    test("a configured default with no match does not fall back to the platform language", function (assert) {
      const result = selectVoice(VOICES, {
        defaultVoice: "pt",
        platformLang: "de",
        browserLangs: ["fr"],
      });

      assert.strictEqual(result.voice, VOICES[3]);
      assert.strictEqual(result.lang, "fr-FR");
      assert.true(result.matched);
    });

    test("uses the platform language when the default is auto", function (assert) {
      const result = selectVoice(VOICES, {
        defaultVoice: "auto",
        platformLang: "de",
      });

      assert.strictEqual(result.voice, VOICES[1]);
      assert.strictEqual(result.lang, "de-DE");
      assert.true(result.matched);
    });

    test("an empty default is treated as auto and unlocks the platform language", function (assert) {
      const result = selectVoice(VOICES, {
        defaultVoice: "",
        platformLang: "fr",
      });

      assert.strictEqual(result.voice, VOICES[3]);
      assert.true(result.matched);
    });

    test("matches the platform language exactly before a prefix match", function (assert) {
      const mixed = [
        { name: "Austrian", lang: "de-AT" },
        { name: "German", lang: "de-DE" },
      ];
      const result = selectVoice(mixed, {
        defaultVoice: "auto",
        platformLang: "de-DE",
      });

      assert.strictEqual(result.voice, mixed[1]);
      assert.true(result.matched);
    });
  }
);

module("TTS Listen | Unit | selectVoice | browser languages", function () {
  test("matches the first browser language that has a voice", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "auto",
      platformLang: "nl",
      browserLangs: ["ja", "de"],
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
  });

  test("keeps trying browser languages in order until one matches", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "auto",
      platformLang: "zh",
      browserLangs: ["ja", "ko", "fr"],
    });

    assert.strictEqual(result.voice, VOICES[3]);
    assert.true(result.matched);
  });

  test("a primary browser language code matches a regional voice", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "auto",
      platformLang: "zh",
      browserLangs: ["de"],
    });

    assert.strictEqual(result.voice, VOICES[1]);
    assert.strictEqual(result.lang, "de-DE");
    assert.true(result.matched);
  });

  test("browser languages run even when a non-auto default found no voice", function (assert) {
    const result = selectVoice(VOICES, {
      defaultVoice: "pt",
      platformLang: "de",
      browserLangs: ["ja", "en"],
    });

    assert.strictEqual(result.voice, VOICES[0]);
    assert.strictEqual(result.lang, "en-US");
    assert.true(result.matched);
  });
});

module(
  "TTS Listen | Unit | selectVoice | no-voice (matched false)",
  function () {
    // list[0] is deliberately not used as a terminal fallback (ADR 0006):
    // its order and value are unspecified across implementations. When
    // nothing configured matches, the ladder returns {voice: null,
    // matched: false} with the configured language it was trying to satisfy,
    // and the player shows the no-voice notice instead of silently speaking
    // the wrong language.
    test("returns no voice with matched false when nothing matches", function (assert) {
      const result = selectVoice(VOICES, {
        defaultVoice: "auto",
        platformLang: "nl",
        browserLangs: ["ja"],
      });

      assert.strictEqual(result.voice, null);
      assert.strictEqual(result.lang, "nl");
      assert.false(result.matched);
    });

    test("never falls back to list[0], even when a non-auto default and browser languages all miss", function (assert) {
      const result = selectVoice(VOICES, {
        defaultVoice: "pt",
        platformLang: "de",
        browserLangs: ["ja", "ko"],
      });

      assert.strictEqual(result.voice, null);
      assert.notStrictEqual(result.voice, VOICES[0]);
      // The configured preference the device could not satisfy is the
      // admin's default, so the notice can name it.
      assert.strictEqual(result.lang, "pt");
      assert.false(result.matched);
    });

    test("the unmatched lang is the user's override language when one is set and falls through", function (assert) {
      const result = selectVoice(VOICES, {
        userVoice: { lang: "ja-JP", name: "Google Japanese (removed)" },
        defaultVoice: "pt",
        platformLang: "de",
        browserLangs: ["ko"],
      });

      assert.strictEqual(result.voice, null);
      assert.strictEqual(result.lang, "ja-JP");
      assert.false(result.matched);
    });

    test("returns no voice and keeps the platform language when no voices exist", function (assert) {
      const result = selectVoice([], { platformLang: "de" });

      assert.strictEqual(result.voice, null);
      assert.strictEqual(result.lang, "de");
      assert.false(result.matched);
    });

    test("defaults the language to en-US when nothing matches at all", function (assert) {
      const result = selectVoice([], {});

      assert.strictEqual(result.voice, null);
      assert.strictEqual(result.lang, "en-US");
      assert.false(result.matched);
    });
  }
);

module("TTS Listen | Unit | selectVoice | full ladder order", function () {
  // One voice per ladder step: a user override for Spanish, a default of
  // Italian, a platform of Portuguese, a browser list of German, and a
  // stray English voice that used to win as the list[0] terminal fallback
  // but now means the ladder falls through to the no-voice result when no
  // configured step matches it.
  const LADDER = [
    { name: "Español", lang: "es-ES" },
    { name: "Italiano", lang: "it-IT" },
    { name: "Português", lang: "pt-PT" },
    { name: "Deutsch", lang: "de-DE" },
    { name: "English", lang: "en-US" },
  ];

  test("user override wins over every automatic step", function (assert) {
    const result = selectVoice(LADDER, {
      userVoice: { lang: "es-ES", name: "Español" },
      defaultVoice: "it-IT",
      platformLang: "pt-PT",
      browserLangs: ["de-DE"],
    });

    assert.strictEqual(result.voice, LADDER[0]);
    assert.true(result.matched);
  });

  test("default voice wins over platform and browser when there is no override", function (assert) {
    const result = selectVoice(LADDER, {
      defaultVoice: "it-IT",
      platformLang: "pt-PT",
      browserLangs: ["de-DE"],
    });

    assert.strictEqual(result.voice, LADDER[1]);
    assert.true(result.matched);
  });

  test("platform language wins over browser when the default is auto", function (assert) {
    const result = selectVoice(LADDER, {
      defaultVoice: "auto",
      platformLang: "pt-PT",
      browserLangs: ["de-DE"],
    });

    assert.strictEqual(result.voice, LADDER[2]);
    assert.true(result.matched);
  });

  test("browser language is the terminal matching step before the no-voice result", function (assert) {
    const result = selectVoice(LADDER, {
      defaultVoice: "auto",
      platformLang: "zh",
      browserLangs: ["de-DE"],
    });

    assert.strictEqual(result.voice, LADDER[3]);
    assert.true(result.matched);
  });

  test("returns no voice when every step misses", function (assert) {
    const result = selectVoice(LADDER, {
      defaultVoice: "auto",
      platformLang: "zh",
      browserLangs: ["ja"],
    });

    assert.strictEqual(result.voice, null);
    assert.strictEqual(result.lang, "zh");
    assert.false(result.matched);
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

  test("a user override identity is matched across normalized lang codes", function (assert) {
    const voices = [{ name: "Android German", lang: "de_DE" }];
    const result = selectVoice(voices, {
      userVoice: { lang: "de-DE", name: "Android German" },
    });

    assert.strictEqual(result.voice, voices[0]);
    assert.true(result.matched);
  });
});

module("TTS Listen | Unit | groupVoicesByLang", function () {
  test("groups voices by their normalized language", function (assert) {
    const voices = [
      { name: "Google US English", lang: "en-US" },
      { name: "Google Deutsch", lang: "de-DE" },
      { name: "Microsoft Katja", lang: "de-DE" },
    ];
    const groups = groupVoicesByLang(voices);

    assert.deepEqual(
      groups.map((g) => g.lang),
      ["de-de", "en-us"]
    );
    assert.strictEqual(groups[0].voices.length, 2);
    assert.strictEqual(groups[1].voices.length, 1);
  });

  test("returns groups in alphabetical order by language code", function (assert) {
    const voices = [
      { name: "Z", lang: "fr-FR" },
      { name: "A", lang: "en-US" },
      { name: "M", lang: "de-DE" },
    ];
    const groups = groupVoicesByLang(voices);

    assert.deepEqual(
      groups.map((g) => g.lang),
      ["de-de", "en-us", "fr-fr"]
    );
  });

  // Android reports underscore locales (de_DE) and Firefox three-letter
  // primaries (deu-DEU-f00); both normalize to the same key as the hyphenated
  // two-letter code and so land in the same <optgroup>.
  test("groups voices whose lang codes normalize to the same key", function (assert) {
    const voices = [
      { name: "Chrome German", lang: "de-DE" },
      { name: "Android German", lang: "de_DE" },
      { name: "Firefox German", lang: "deu-DEU-f00" },
    ];
    const groups = groupVoicesByLang(voices);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].lang, "de-de");
    assert.strictEqual(groups[0].voices.length, 3);
  });

  test("drops duplicate voices that share a name within a language group", function (assert) {
    const voices = [
      { name: "Google Deutsch", lang: "de-DE" },
      { name: "Google Deutsch", lang: "de-DE" },
      { name: "Microsoft Katja", lang: "de-DE" },
    ];
    const groups = groupVoicesByLang(voices);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].voices.length, 2);
    assert.strictEqual(groups[0].voices[0].name, "Google Deutsch");
    assert.strictEqual(groups[0].voices[1].name, "Microsoft Katja");
  });

  test("keeps each voice's original lang code intact in the group", function (assert) {
    const voices = [{ name: "Android German", lang: "de_DE" }];
    const groups = groupVoicesByLang(voices);

    assert.strictEqual(groups[0].lang, "de-de");
    assert.strictEqual(groups[0].voices[0].lang, "de_DE");
  });

  test("returns an empty array for empty or missing input", function (assert) {
    assert.deepEqual(groupVoicesByLang([]), []);
    assert.deepEqual(groupVoicesByLang(undefined), []);
    assert.deepEqual(groupVoicesByLang(null), []);
  });
});
