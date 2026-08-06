#!/usr/bin/env node
// Regenerate the per-platform voice-name `choices` lists in settings.yml from
// the vendored recommended-voice index.
//
// The admin drop-downs pin a voice *name* per platform (ADR 0009); the names a
// visitor can be matched against live in
// javascripts/discourse/lib/tts-recommended-voices.js. When that index is
// refreshed (see docs/research/0002-refresh-recommended-voices.md), the choice
// lists in settings.yml go stale unless they are regenerated too — otherwise an
// admin could pin a name the index no longer carries, or miss a newly added
// voice. This script prints the eight `enum` choice blocks so they can be
// pasted back into settings.yml, and is the single source of truth for keeping
// the two in sync.
//
// Usage: node scripts/build-voice-choices.mjs
// Run from the repo root. Prints one block per platform setting, in the same
// order settings.yml expects, each beginning with the `auto` (no-pin) entry.

import { RECOMMENDED_VOICES } from "../javascripts/discourse/lib/tts-recommended-voices.js";

// Setting name -> the single platform tag (os or browser) the drop-down pins a
// voice for. Kept in settings.yml order. These mirror detectPlatform's tags
// (see javascripts/discourse/lib/tts-platform.js): `os` ∈ macOS/iOS/iPadOS/
// Windows/Android/ChromeOS; `browser` ∈ Edge/ChromeDesktop.
const PLATFORMS = [
  ["voice_macos", "macOS"],
  ["voice_ios", "iOS"],
  ["voice_ipados", "iPadOS"],
  ["voice_windows", "Windows"],
  ["voice_android", "Android"],
  ["voice_chromeos", "ChromeOS"],
  ["voice_chrome_desktop", "ChromeDesktop"],
  ["voice_edge", "Edge"],
];

function tagsOf(entry) {
  const tags = [];
  if (Array.isArray(entry.os)) {
    tags.push(...entry.os);
  }
  if (Array.isArray(entry.browser)) {
    tags.push(...entry.browser);
  }
  return tags;
}

// Preserve the index's family order (de, en, fr, es, it, pt, nl) so the
// drop-down groups voices by language, the closest a flat enum can get to the
// "pick a language, then see that language's voices" intent (ADR 0009).
const familyOrder = Object.keys(RECOMMENDED_VOICES);

function choicesFor(tag) {
  const items = [];
  for (const family of familyOrder) {
    for (const voice of RECOMMENDED_VOICES[family].voices) {
      if (tagsOf(voice).includes(tag)) {
        // lang-prefixed so the admin can tell languages apart in one flat
        // list; the player parses "<lang>: <name>" back to a {lang, name}
        // pin. ": " never appears in a vendored voice name (verified by the
        // refresh note's checklist), so the split is unambiguous.
        items.push(`${voice.language}: ${voice.name}`);
      }
    }
  }
  return items;
}

for (const [setting, tag] of PLATFORMS) {
  const items = choicesFor(tag);
  const lines = [`${setting}:`, "  type: enum", "  default: auto", "  choices:", "    - auto"];
  for (const item of items) {
    lines.push(`    - ${JSON.stringify(item)}`);
  }
  process.stdout.write(`${lines.join("\n")}\n\n`);
}