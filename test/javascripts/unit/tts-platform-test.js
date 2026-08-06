import { module, test } from "qunit";
import { detectPlatform } from "../../../discourse/lib/tts-platform";

// A minimal fake `navigator`: only `userAgent` (and optionally `platform` /
// `userAgentData`) is read by detectPlatform. QUnit runs in a Discourse
// container, so these are plain objects standing in for the real Navigator.
function nav(userAgent, platform = "") {
  return { userAgent, platform };
}

module("TTS Listen | Unit | detectPlatform | os", function () {
  test("macOS Safari → os macOS", function (assert) {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["macOS"]);
  });

  test("macOS Chrome → os macOS", function (assert) {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["macOS"]);
  });

  test("Windows → os Windows", function (assert) {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["Windows"]);
  });

  test("iPhone → os iOS", function (assert) {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["iOS"]);
  });

  // iPadOS reports a desktop Mac UA, so both tags are returned: recommended
  // voices listed under macOS must still match on an iPad.
  test("iPad → os iPadOS and macOS (ambiguous)", function (assert) {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["iPadOS", "macOS"]);
  });

  test("Android → os Android", function (assert) {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["Android"]);
  });

  test("ChromeOS → os ChromeOS", function (assert) {
    const ua =
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).os, ["ChromeOS"]);
  });
});

module("TTS Listen | Unit | detectPlatform | browser", function () {
  test("Edge desktop → browser Edge (not ChromeDesktop, though UA has Chrome/)", function (assert) {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    assert.deepEqual(detectPlatform(nav(ua)).browser, ["Edge"]);
  });

  test("Chrome desktop → browser ChromeDesktop", function (assert) {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).browser, ["ChromeDesktop"]);
  });

  test("Safari desktop → no browser tag (no Chrome/-specific voices)", function (assert) {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    assert.deepEqual(detectPlatform(nav(ua)).browser, []);
  });

  test("Firefox desktop → no browser tag", function (assert) {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
    assert.deepEqual(detectPlatform(nav(ua)).browser, []);
  });

  test("Chrome on Android → no browser tag (mobile has no browser-specific voices)", function (assert) {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    assert.deepEqual(detectPlatform(nav(ua)).browser, []);
  });

  test("Chrome on iPhone → no browser tag (iOS voices apply regardless)", function (assert) {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
    assert.deepEqual(detectPlatform(nav(ua)).browser, []);
  });
});

module("TTS Listen | Unit | detectPlatform | edge cases", function () {
  test("an empty navigator returns empty tag arrays", function (assert) {
    assert.deepEqual(detectPlatform({}), { os: [], browser: [] });
  });

  test("a navigator with only a platform still resolves os when UA is empty", function (assert) {
    assert.deepEqual(detectPlatform({ platform: "MacIntel" }).os, ["macOS"]);
    assert.deepEqual(detectPlatform({ platform: "Win32" }).os, ["Windows"]);
  });

  test("an unrecognized UA returns empty os and browser arrays", function (assert) {
    assert.deepEqual(detectPlatform(nav("some-bot/1.0")), {
      os: [],
      browser: [],
    });
  });

  // Word-boundary OS checks: substrings like "win" in "darwin" or "mac" in
  // "machine" must not misdetect an OS.
  test("UAs containing 'darwin' or 'machine'-like tokens are not misdetected", function (assert) {
    assert.deepEqual(detectPlatform(nav("somebot/1.0 (darwin; x64)")).os, []);
    assert.deepEqual(detectPlatform(nav("machine-crawler/2.0")).os, []);
  });
});
