import { module, test } from "qunit";
import {
  playerForElement,
  remapChunks,
} from "../../../discourse/lib/tts-lifecycle";

function fakePlayer(state = "idle") {
  return { state };
}

// Regression guard for the scroll bug: Discourse "cloaks" posts that scroll
// out of view (removes them from the DOM) and re-renders them when they come
// back. The player must survive that re-render and keep speaking, instead of
// being torn down mid-sentence.
module("TTS Listen | Unit | playerForElement", function () {
  test("creates and registers a fresh player when the post has no player yet", function (assert) {
    const players = new Map();
    const { player, reused } = playerForElement(players, 7, () =>
      fakePlayer("idle")
    );

    assert.false(reused);
    assert.strictEqual(players.get(7), player);
  });

  test("reuses the existing player while it is speaking", function (assert) {
    const players = new Map();
    const existing = fakePlayer("playing");
    players.set(7, existing);

    const { player, reused } = playerForElement(players, 7, () =>
      fakePlayer("idle")
    );

    assert.true(reused);
    assert.strictEqual(player, existing);
    assert.strictEqual(players.get(7), existing);
  });

  test("reuses the existing player while it is paused", function (assert) {
    const players = new Map();
    const existing = fakePlayer("paused");
    players.set(7, existing);

    const { player, reused } = playerForElement(players, 7, () =>
      fakePlayer("idle")
    );

    assert.true(reused);
    assert.strictEqual(player, existing);
  });

  test("replaces a finished player with a fresh one", function (assert) {
    const players = new Map();
    players.set(7, fakePlayer("done"));

    const { player, reused } = playerForElement(players, 7, () =>
      fakePlayer("idle")
    );

    assert.false(reused);
    assert.strictEqual(players.get(7), player);
    assert.notStrictEqual(player.state, "done");
  });

  test("replaces an idle player that never started with a fresh one", function (assert) {
    const players = new Map();
    players.set(7, fakePlayer("idle"));

    const { player, reused } = playerForElement(players, 7, () =>
      fakePlayer("idle")
    );

    assert.false(reused);
    assert.strictEqual(players.get(7), player);
  });

  test("creates an unregistered per-element player when the post id is unknown", function (assert) {
    const players = new Map();
    const { player, reused } = playerForElement(players, null, () =>
      fakePlayer("idle")
    );

    assert.false(reused);
    assert.strictEqual(players.size, 0);
    assert.strictEqual(player.state, "idle");
  });
});

module("TTS Listen | Unit | remapChunks", function () {
  test("swaps in the freshly rendered chunks when the content is unchanged", function (assert) {
    const previous = [
      { el: {}, text: "First sentence." },
      { el: {}, text: "Second sentence." },
    ];
    const fresh = [
      { el: {}, text: "First sentence." },
      { el: {}, text: "Second sentence." },
    ];

    assert.strictEqual(remapChunks(previous, fresh), fresh);
  });

  test("keeps the previously captured chunks when the post was edited", function (assert) {
    const previous = [
      { el: {}, text: "First sentence." },
      { el: {}, text: "Second sentence." },
    ];
    const fresh = [
      { el: {}, text: "First sentence." },
      { el: {}, text: "Second sentence." },
      { el: {}, text: "Third sentence." },
    ];

    assert.strictEqual(remapChunks(previous, fresh), previous);
  });

  test("keeps the previously captured chunks when the text changed but the count did not", function (assert) {
    const previous = [{ el: {}, text: "Old text." }];
    const fresh = [{ el: {}, text: "New text." }];

    assert.strictEqual(remapChunks(previous, fresh), previous);
  });

  test("keeps the previously captured chunks when the fresh post has nothing readable", function (assert) {
    const previous = [{ el: {}, text: "First sentence." }];

    assert.strictEqual(remapChunks(previous, []), previous);
  });
});
