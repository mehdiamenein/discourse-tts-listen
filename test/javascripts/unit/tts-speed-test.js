import { module, test } from "qunit";
import {
  buildSpeedOptions,
  DEFAULT_VALUE,
  MAX_RATE,
  MIN_RATE,
  nearestGridValue,
} from "../../../discourse/lib/tts-speed";

module("TTS Listen | Unit | buildSpeedOptions", function () {
  test("offers 20 speed options from 0.1× to 2.0× plus a Default entry", function (assert) {
    const options = buildSpeedOptions({ defaultLabel: "Default" });

    // Default entry first, then 20 grid values.
    assert.strictEqual(options.length, 21);
    assert.strictEqual(options[0].value, DEFAULT_VALUE);
    assert.strictEqual(options[0].label, "Default");

    const grid = options.slice(1);
    assert.deepEqual(
      grid.map((o) => o.value),
      Array.from({ length: 20 }, (_, i) => String((i + 1) / 10))
    );
  });

  test("steps are exactly 0.1 apart with no floating-point drift", function (assert) {
    const grid = buildSpeedOptions().slice(1);

    for (let i = 0; i < grid.length; i += 1) {
      const rate = parseFloat(grid[i].value);
      assert.strictEqual(rate, (i + 1) / 10, `option ${i} is ${(i + 1) / 10}`);
      assert.strictEqual(rate, Math.round(rate * 10) / 10, "no drift");
    }
  });

  test("labels render the rate with a × suffix", function (assert) {
    const options = buildSpeedOptions();

    assert.strictEqual(options[1].label, "0.1×");
    assert.strictEqual(options[10].label, "1×");
    assert.strictEqual(options[20].label, "2×");
  });

  test("selects the Default entry when no rate is selected", function (assert) {
    const options = buildSpeedOptions({ selectedRate: null });

    assert.true(options[0].selected);
    assert.false(options.slice(1).some((o) => o.selected));
  });

  test("selects the exact grid rate when it is on the grid", function (assert) {
    const options = buildSpeedOptions({ selectedRate: 1 });

    assert.false(options[0].selected);
    assert.true(options[10].selected, "1× is selected");
    assert.false(options[5].selected);
  });

  test("snaps an off-grid rate to the nearest grid value", function (assert) {
    // The setting has no step field, so an admin can set e.g. 0.85; the
    // drop-down must still show a valid option as selected.
    const options = buildSpeedOptions({ selectedRate: 0.85 });

    assert.false(options[0].selected);
    assert.true(options[9].selected, "0.85 snaps to 0.9×");
  });

  test("clamps an out-of-range rate to the grid ends", function (assert) {
    const tooLow = buildSpeedOptions({ selectedRate: 0 });
    assert.true(tooLow[1].selected, "0 clamps up to 0.1×");

    const tooHigh = buildSpeedOptions({ selectedRate: 5 });
    assert.true(tooHigh[20].selected, "5 clamps down to 2×");
  });

  test("uses the provided Default label verbatim", function (assert) {
    const options = buildSpeedOptions({ defaultLabel: "Standard" });

    assert.strictEqual(options[0].label, "Standard");
  });
});

module("TTS Listen | Unit | nearestGridValue", function () {
  test("returns on-grid rates unchanged", function (assert) {
    assert.strictEqual(nearestGridValue(1), 1);
    assert.strictEqual(nearestGridValue(0.1), MIN_RATE);
    assert.strictEqual(nearestGridValue(2), MAX_RATE);
  });

  test("rounds an off-grid rate to the nearest 0.1 step", function (assert) {
    assert.strictEqual(nearestGridValue(0.85), 0.9);
    assert.strictEqual(nearestGridValue(0.84), 0.8);
    assert.strictEqual(nearestGridValue(1.25), 1.3);
    assert.strictEqual(nearestGridValue(1.24), 1.2);
  });

  test("clamps below the floor to MIN_RATE", function (assert) {
    assert.strictEqual(nearestGridValue(0), MIN_RATE);
    assert.strictEqual(nearestGridValue(-1), MIN_RATE);
    assert.strictEqual(nearestGridValue(0.05), MIN_RATE);
  });

  test("clamps above the ceiling to MAX_RATE", function (assert) {
    assert.strictEqual(nearestGridValue(2.5), MAX_RATE);
    assert.strictEqual(nearestGridValue(3), MAX_RATE);
    assert.strictEqual(nearestGridValue(100), MAX_RATE);
  });

  test("falls back to 1 for a non-finite rate", function (assert) {
    assert.strictEqual(nearestGridValue(NaN), 1);
    assert.strictEqual(nearestGridValue(undefined), 1);
    assert.strictEqual(nearestGridValue("garbage"), 1);
  });
});
