import { module, test } from "qunit";
import {
  preferRecommendedVoice,
  RECOMMENDED_VOICES,
} from "../../../discourse/lib/tts-recommended-voices";

// A tiny synthetic index keeps these tests stable and decoupled from the
// vendored Readium snapshot (which changes as voices ship). The algorithm
// is what matters; the data is exercised by the integration cases at the
// end.
const MAC = { os: ["macOS"], browser: [] };
const WIN = { os: ["Windows"], browser: [] };
const EDGE = { os: ["Windows"], browser: ["Edge"] };
const SAFARI = { os: ["macOS"], browser: [] };

function index(voices) {
  return { de: { defaultRegion: "de-DE", voices } };
}

module("TTS Listen | Unit | preferRecommendedVoice | ranking", function () {
  test("preloaded beats higher quality (priority: preloaded > quality)", function (assert) {
    const recommended = index([
      { name: "HighNotPreloaded", language: "de-DE", quality: ["veryHigh"] },
      {
        name: "NormalPreloaded",
        language: "de-DE",
        quality: ["normal"],
        preloaded: true,
      },
    ]);
    const voices = [
      { name: "HighNotPreloaded", lang: "de-DE" },
      { name: "NormalPreloaded", lang: "de-DE" },
    ];

    assert.strictEqual(
      preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
      voices[1]
    );
  });

  test("quality breaks a tie between equally-preloaded voices", function (assert) {
    const recommended = index([
      {
        name: "Normal",
        language: "de-DE",
        quality: ["normal"],
        preloaded: true,
      },
      {
        name: "VeryHigh",
        language: "de-DE",
        quality: ["veryHigh"],
        preloaded: true,
      },
    ]);
    const voices = [
      { name: "Normal", lang: "de-DE" },
      { name: "VeryHigh", lang: "de-DE" },
    ];

    assert.strictEqual(
      preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
      voices[1]
    );
  });

  test("region match beats preloaded (priority: region > preloaded)", function (assert) {
    // Bare family code "de" → region de-DE. The de-DE entry is not preloaded
    // but matches the region; the de-AT entry is preloaded but off-region.
    const recommended = index([
      {
        name: "AustrianPreloaded",
        language: "de-AT",
        quality: ["normal"],
        preloaded: true,
      },
      { name: "GermanNotPreloaded", language: "de-DE", quality: ["normal"] },
    ]);
    const voices = [
      { name: "AustrianPreloaded", lang: "de-AT" },
      { name: "GermanNotPreloaded", lang: "de-DE" },
    ];

    assert.strictEqual(
      preferRecommendedVoice(voices, "de", { recommended, platform: MAC }),
      voices[1]
    );
  });

  test("localService (offline) breaks a tie between equal entries", function (assert) {
    // Two device voices share a recommended name (e.g. an installed local
    // copy and an online copy); the offline one is preferred.
    const recommended = index([
      { name: "Twin", language: "de-DE", quality: ["high"], preloaded: true },
    ]);
    const voices = [
      { name: "Twin", lang: "de-DE", localService: false },
      { name: "Twin", lang: "de-DE", localService: true },
    ];

    assert.strictEqual(
      preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
      voices[1]
    );
  });
});

module(
  "TTS Listen | Unit | preferRecommendedVoice | matching & platform filter",
  function () {
    test("matches a device voice by altNames (Android ugly name)", function (assert) {
      const recommended = index([
        {
          name: "Google Deutsch 2 (Natural)",
          altNames: [
            "Android Speech Recognition and Synthesis from Google de-de-x-dea-network",
          ],
          language: "de-DE",
          quality: ["high"],
          preloaded: true,
          os: ["Android", "ChromeOS"],
        },
      ]);
      const voices = [
        {
          name: "Android Speech Recognition and Synthesis from Google de-de-x-dea-network",
          lang: "de-DE",
        },
      ];

      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", {
          recommended,
          platform: { os: ["Android"], browser: [] },
        }),
        voices[0]
      );
    });

    test("a localizedName:'apple' entry is matched by name on Apple devices", function (assert) {
      const recommended = index([
        {
          name: "Anna",
          localizedName: "apple",
          language: "de-DE",
          quality: ["low", "normal", "high"],
          preloaded: true,
          os: ["macOS", "iOS", "iPadOS"],
        },
      ]);
      const voices = [{ name: "Anna", lang: "de-DE", localService: true }];

      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
        voices[0]
      );
    });

    test("an os-tagged entry is excluded on a non-matching platform", function (assert) {
      const recommended = index([
        {
          name: "WinOnly",
          language: "de-DE",
          quality: ["normal"],
          preloaded: true,
          os: ["Windows"],
        },
        { name: "Any", language: "de-DE", quality: ["low"], preloaded: true },
      ]);
      const voices = [
        { name: "WinOnly", lang: "de-DE" },
        { name: "Any", lang: "de-DE" },
      ];

      // On macOS, "WinOnly" is filtered out; "Any" (no os tag) is universal.
      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
        voices[1]
      );
      // On Windows, "WinOnly" wins (higher quality, both preloaded).
      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", { recommended, platform: WIN }),
        voices[0]
      );
    });

    test("a browser-tagged entry is excluded on a non-matching browser", function (assert) {
      const recommended = index([
        {
          name: "EdgeOnly",
          language: "de-DE",
          quality: ["veryHigh"],
          preloaded: true,
          browser: ["Edge"],
        },
        { name: "Any", language: "de-DE", quality: ["low"], preloaded: true },
      ]);
      const voices = [
        { name: "EdgeOnly", lang: "de-DE" },
        { name: "Any", lang: "de-DE" },
      ];

      // On Safari (no browser tag), "EdgeOnly" is filtered out.
      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", {
          recommended,
          platform: SAFARI,
        }),
        voices[1]
      );
      // On Edge, "EdgeOnly" wins.
      assert.strictEqual(
        preferRecommendedVoice(voices, "de-DE", {
          recommended,
          platform: EDGE,
        }),
        voices[0]
      );
    });
  }
);

module("TTS Listen | Unit | preferRecommendedVoice | degrade", function () {
  test("returns null for a language absent from the index", function (assert) {
    const recommended = index([
      { name: "Anna", language: "de-DE", quality: ["high"], preloaded: true },
    ]);
    const voices = [{ name: "X", lang: "ja-JP" }];

    assert.strictEqual(
      preferRecommendedVoice(voices, "ja", { recommended, platform: MAC }),
      null
    );
  });

  test("returns null when no recommended name is installed", function (assert) {
    const recommended = index([
      {
        name: "Anna",
        language: "de-DE",
        quality: ["high"],
        preloaded: true,
        os: ["macOS"],
      },
    ]);
    const voices = [{ name: "Mystery Voice", lang: "de-DE" }];

    assert.strictEqual(
      preferRecommendedVoice(voices, "de-DE", { recommended, platform: MAC }),
      null
    );
  });

  test("defaults to empty index/platform when omitted (still returns null, never throws)", function (assert) {
    const voices = [{ name: "Anna", lang: "de-DE" }];

    assert.strictEqual(preferRecommendedVoice(voices, "de-DE", {}), null);
    assert.strictEqual(preferRecommendedVoice(voices, "de-DE"), null);
  });
});

module(
  "TTS Listen | Unit | preferRecommendedVoice | vendored index (integration)",
  function () {
    test("macOS German → Anna (Apple preloaded, de-DE)", function (assert) {
      const voices = [
        { name: "Anna", lang: "de-DE", localService: true },
        { name: "Helena", lang: "de-DE", localService: true },
        { name: "Google Deutsch", lang: "de-DE", localService: false },
      ];

      assert.strictEqual(
        preferRecommendedVoice(voices, "de", {
          recommended: RECOMMENDED_VOICES,
          platform: { os: ["macOS"], browser: [] },
        }).name,
        "Anna"
      );
    });

    test("Windows German → a Microsoft local voice (not an Edge-only one)", function (assert) {
      const voices = [
        {
          name: "Microsoft Hedda - German (Germany)",
          lang: "de-DE",
          localService: true,
        },
        {
          name: "Microsoft Katja Online (Natural) - German (Germany)",
          lang: "de-DE",
          localService: false,
        },
      ];

      // On plain Windows (no Edge browser tag), the Edge-only online voice
      // is filtered out; the local Hedda voice is picked.
      assert.strictEqual(
        preferRecommendedVoice(voices, "de", {
          recommended: RECOMMENDED_VOICES,
          platform: { os: ["Windows"], browser: [] },
        }).name,
        "Microsoft Hedda - German (Germany)"
      );
    });

    test("Edge German → the veryHigh Edge online voice", function (assert) {
      const voices = [
        {
          name: "Microsoft Hedda - German (Germany)",
          lang: "de-DE",
          localService: true,
        },
        {
          name: "Microsoft Katja Online (Natural) - German (Germany)",
          lang: "de-DE",
          localService: false,
        },
      ];

      // On Edge, the veryHigh Edge voice beats the normal local one
      // (quality > localService at this tier).
      assert.strictEqual(
        preferRecommendedVoice(voices, "de", {
          recommended: RECOMMENDED_VOICES,
          platform: { os: ["Windows"], browser: ["Edge"] },
        }).name,
        "Microsoft Katja Online (Natural) - German (Germany)"
      );
    });

    test("bare family 'de' prefers the de-DE Edge voice over the de-AT one (region match)", function (assert) {
      // Readium lists no Apple de-AT voice, so region preference is exercised
      // with Edge's de-AT (Jonas) and de-DE (Katja) online voices, which tie
      // on every rank except region when the admin set a bare "de".
      const voices = [
        {
          name: "Microsoft Jonas Online (Natural) - German (Austria)",
          lang: "de-AT",
          localService: false,
        },
        {
          name: "Microsoft Katja Online (Natural) - German (Germany)",
          lang: "de-DE",
          localService: false,
        },
      ];

      assert.strictEqual(
        preferRecommendedVoice(voices, "de", {
          recommended: RECOMMENDED_VOICES,
          platform: { os: ["Windows"], browser: ["Edge"] },
        }).name,
        "Microsoft Katja Online (Natural) - German (Germany)"
      );

      // And the explicit de-AT code flips it the other way.
      assert.strictEqual(
        preferRecommendedVoice(voices, "de-AT", {
          recommended: RECOMMENDED_VOICES,
          platform: { os: ["Windows"], browser: ["Edge"] },
        }).name,
        "Microsoft Jonas Online (Natural) - German (Austria)"
      );
    });
  }
);
