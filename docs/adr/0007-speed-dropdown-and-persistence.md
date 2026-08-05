# Speed drop-down: 0.1–2.0 in 0.1 steps, persisted, aligned with `default_rate`

**Status:** Accepted.

The playback-speed drop-down offers 0.1 steps from 0.1× to 2.0× (20 options),
replacing the previous coarse 0.25-step set (`0.75, 1, 1.25, 1.5, 2`). The
`default_rate` setting is aligned to the same range (`min: 0.1, max: 2.0`,
constrained to 0.1 steps, default `1.0`) so an admin's default is always a real
value in the drop-down.

Two reasons for the granularity and range:

- Visitor testing showed 0.8× is a comfortable speed for some readers; finer
  steps than 0.25 let people land on the rate that suits them. The full 0.1
  floor is kept deliberately — "options people don't use" are preferred over
  "constraints that frustrate the one person who needed it".
- The previous `default_rate` range (0.5–3.0) disagreed with the drop-down
  (capped at 2.0), so an admin default of e.g. 2.5 could not be displayed or
  stepped to. Aligning both ends to 0.1–2.0 removes that mismatch.

The chosen rate is **persisted per-browser in `localStorage`** with the same
revert semantics as the voice override: selecting "Default" clears the stored
rate and the player falls back to `default_rate`. Changing speed mid-playback
still restarts the current chunk at the new rate, as before.