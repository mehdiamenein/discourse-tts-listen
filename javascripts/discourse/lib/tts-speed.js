// Pure, dependency-free playback-speed options for the TTS player.
//
// Kept separate from the UI code so it can be unit-tested in isolation. The
// drop-down offers 0.1 steps from 0.1× to 2.0× (20 options), aligned with the
// `default_rate` setting range (see ADR 0007). The 0.1 grid is enforced here,
// in the option list — `default_rate` is a plain Discourse float setting with
// no `step` field, so the drop-down is the only place that constrains the
// value to the grid.
//
// A "Default" entry (value "" / rate null) selects the admin's `default_rate`
// and clears the per-browser override (mirroring the voice selector's revert
// semantics). Any other value is a concrete rate on the grid.

/**
 * Lowest and highest rates the drop-down offers, and the step between them.
 * Kept as exact decimals (integers × 10) so there is no floating-point drift
 * between 0.1 + 0.1 + 0.1 … and the values shown in the UI.
 */
export const MIN_RATE = 0.1;
export const MAX_RATE = 2.0;
export const STEP = 0.1;

// The value that marks the "Default" option. An empty string keeps the
// <option> value a clean sentinel distinct from every real grid value.
export const DEFAULT_VALUE = "";

/**
 * Round a rate to the nearest 0.1 step inside the supported range.
 *
 * Used to pre-select the drop-down option that best matches an off-grid
 * `default_rate` (the setting has no step constraint, so an admin could
 * set e.g. 0.85). Values below the floor snap to the floor, values above
 * the ceiling snap to the ceiling.
 *
 * @param {number} rate
 * @returns {number} a rate on the 0.1 grid within [MIN_RATE, MAX_RATE].
 */
export function nearestGridValue(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r)) {
    return 1;
  }
  // Round to one decimal; multiply/divide by 10 to dodge 0.1 + 0.1 drift.
  const snapped = Math.round(r * 10) / 10;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, snapped));
}

/**
 * Build the drop-down option list for the speed selector.
 *
 * Returns 20 options from 0.1× to 2.0× in 0.1 steps, plus a leading
 * "Default" option whose value is `DEFAULT_VALUE`. The `selected` flag is
 * set on whichever real option matches `selectedRate` (snapped to the
 * grid), or on the "Default" option when `selectedRate` is null/undefined
 * (meaning the user has reverted to `default_rate`).
 *
 * Pure: it takes the rate to pre-select and the label for the "Default"
 * option, and returns plain data — the player turns it into <option>
 * elements. This makes the grid, the step, and the snap logic testable
 * without a DOM.
 *
 * @param {object} [opts]
 * @param {number|null|undefined} [opts.selectedRate]
 *   The rate to mark as selected, or null/undefined for the "Default" entry.
 * @param {string} [opts.defaultLabel]
 *   Label for the leading "Default" option.
 * @returns {Array<{ value: string, label: string, selected: boolean }>}
 */
export function buildSpeedOptions({
  selectedRate = null,
  defaultLabel = "Default",
} = {}) {
  const options = [
    {
      value: DEFAULT_VALUE,
      label: defaultLabel,
      selected: selectedRate == null,
    },
  ];

  for (let i = 1; i <= 20; i += 1) {
    const rate = i / 10;
    options.push({
      value: String(rate),
      label: `${rate}×`,
      selected: selectedRate != null && nearestGridValue(selectedRate) === rate,
    });
  }

  return options;
}
