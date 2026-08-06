# Refresh: vendored recommended-voice index

The recommended-voice index lives in
`javascripts/discourse/lib/tts-recommended-voices.js` as `RECOMMENDED_VOICES`,
and the matching/ranking logic as `preferRecommendedVoice` in the same file.
The data is a **snapshot** derived from the [Readium Speech][readium] project;
it rots as Apple, Google and Microsoft ship new voices. Regenerate it
periodically (a release-checklist item), review the diff, and commit. The
index ships to every visitor (ADR 0003), so regenerated snapshots must stay
lean: only the kept fields below, no verbose vendor fields.

## What is kept

Each voice keeps only the fields `selectVoice` → `pickVoiceForLang` →
`preferRecommendedVoice` needs for selection:

- `name` — the canonical voice name (matched against the device `name`).
- `altNames` — aliases (kept only when non-empty; Android's
  `Android Speech Recognition and Synthesis from Google de-de-x-dea-network`-
  style names map to one voice).
- `localizedName` — kept only when present (`"apple"` marks macOS/iOS voices
  whose display name is localized by system locale).
- `language` — the region, e.g. `de-DE` (used for the region-match ranking
  key and the bare-family-code `defaultRegion` preference).
- `os` — kept only when non-empty (`macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/
  `ChromeOS`); an empty/absent `os` means "available on every platform".
- `browser` — kept only when non-empty (`Edge`/`ChromeDesktop`).
- `quality` — the tier array (`veryHigh`/`high`/`normal`/`low`); ranking uses
  the best entry.
- `preloaded` — kept only when `true` (absent means `false`).

Dropped (not used for selection): `label`, `gender`, `testUtterance`, `pitch`,
`pitchControl`, `rate`, `note`, `nativeID`, `multiLingual`, `children`,
`otherLanguages`, and any vendor-specific extras.

## How to regenerate

The index covers a core set of languages (`de en fr es it pt nl`). To expand
or refresh:

1. Fetch the Readium JSON for each language:
   ```sh
   for l in de en fr es it pt nl; do
     curl -fsSL "https://raw.githubusercontent.com/readium/speech/main/json/$l.json" -o "readium-$l.json"
   done
   ```
2. Compact each voice to the kept fields and emit the `RECOMMENDED_VOICES`
   object literal, then concatenate it with the unchanged
   `preferRecommendedVoice` logic. A reference generator (used to produce the
   current snapshot) is:

   ```python
   import json
   LANGS = ["de", "en", "fr", "es", "it", "pt", "nl"]
   def compact(v):
       out = {"name": v["name"], "language": v.get("language",""), "quality": v.get("quality",[])}
       if v.get("altNames"):  out["altNames"] = v["altNames"]
       if v.get("localizedName"): out["localizedName"] = v["localizedName"]
       if v.get("os"):  out["os"] = v["os"]
       if v.get("browser"): out["browser"] = v["browser"]
       if v.get("preloaded"): out["preloaded"] = True
       return out
   index = {}
   for l in LANGS:
       d = json.load(open(f"readium-{l}.json"))
       index[l] = {"defaultRegion": d.get("defaultRegion",""), "voices": [compact(v) for v in d.get("voices",[])]}
   print(json.dumps(index, indent=2, ensure_ascii=False))
   ```

   Keep the file's header comment and the `preferRecommendedVoice` body
   unchanged — only the `RECOMMENDED_VOICES = { … };` data changes.

3. To add a language, add its code to `LANGS` (it must exist in
   `settings.yml`'s `default_voice` enum) and re-run. Languages Readium does
   not cover are simply omitted; `selectVoice` degrades gracefully to "any
   voice of the language" (today's behavior) for them — see invariant I1 in
   `tts-selection-test.js`.
4. **Regenerate the admin drop-down choices.** The eight per-platform
   `voice_*` enums in `settings.yml` (ADR 0009) are *derived* from this index;
   after changing it, run `node scripts/build-voice-choices.mjs` and paste its
   output back into the matching `voice_*:` blocks in `settings.yml` (keeping
   the `auto` leading entry). A stale `settings.yml` would let an admin pin a
   name the index no longer carries, or miss a newly added voice.
5. **Guard the choice separator.** The choice value is `"<lang>: <name>"` and
   the player splits on the first `": "`. `": "` must never appear inside a
   vendored voice `name`; run a quick check over the index before committing a
   refresh (the current snapshot has none). If a future vendor name contains
   `": "`, switch the separator and update `parseAdminPin` together.

## Verification

- `pnpm lint:js` (eslint) and `pnpm lint:types` (ember-tsc) stay green.
- The QUnit suite (`tts-recommended-voices-test.js`, `tts-selection-test.js`)
  runs in the Discourse `frontend_tests` CI job. The synthetic-fixture tests
  pin the algorithm; the integration cases against `RECOMMENDED_VOICES` will
  need their expected voice names updated if a curated voice is renamed.
- The two regression invariants (I1 no-op-degrade, I2 notice-never-fires) in
  `tts-selection-test.js` must remain green after any refresh, plus the I3
  no-op invariant for the ADR 0009 admin-pin layer.

[readium]: https://github.com/readium/speech