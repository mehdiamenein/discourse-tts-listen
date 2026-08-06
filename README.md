# TTS Listen Button for Discourse

[![Discourse Theme CI](https://github.com/mehdiamenein/discourse-tts-listen/actions/workflows/discourse-theme.yml/badge.svg)](https://github.com/mehdiamenein/discourse-tts-listen/actions/workflows/discourse-theme.yml)

A simple [Discourse](https://www.discourse.org/) theme component that adds an
accessible **"Listen" button** to every post, powered by the browser's built-in
text-to-speech (Web Speech API). 100% on-device: no external services, no API
keys, no audio files, no privacy exposure.

## Why this exists

We built this for our own community so members can listen to long posts instead
of reading them — a small accessibility and convenience win. It is a
deliberately simple solution: one theme component, no plugins, no servers, no
cost. We are releasing it as open source under the MIT license in the hope that
it helps other communities a little bit too. Use it, fork it, improve it.

## Features

- Detects `speechSynthesis` support and only renders the player when available
- Reads only the post body — never navigation or UI chrome
- Play / pause / resume / stop, a playback-speed drop-down, and an optional
  voice picker
- A **single preferred voice language** (no second-choice fallback): when the
  device has no voice for it, the player says so honestly instead of silently
  switching languages
- Speech language follows the **platform's default language** (Discourse
  locale), not the visitor's browser — German-first communities get German
  voices automatically (when the admin leaves the default on `auto`)
- A visitor's own voice and speed choices **persist per-browser** and always
  win; picking "Default" reverts to the admin setting so a later change is
  picked up again
- Player controls are **localized via theme translations** (German on German
  forums, English on English forums); English is the fallback
- **Keeps reading while you scroll** — posts re-rendered by Discourse as they
  scroll out of view and back never cut the voice off mid-sentence
- Highlights the paragraph currently being read
- Keyboard accessible, visible focus states, `aria-live` status announcements
- Never autoplays; speech stops when you navigate away
- Splits long paragraphs at sentence boundaries to avoid browser cutoffs
- Skips code blocks and/or quotes (configurable)
- No template overrides — pure `decorateCookedElement`, inherits your theme's
  design via Discourse CSS variables

## Requirements

- Discourse **3.2.0** or newer
- A browser with Web Speech API support (see table below)

## Installation

1. Go to **Admin → Appearance → Themes and components → Install →
   From a git repository**
2. Paste: `https://github.com/mehdiamenein/discourse-tts-listen`
3. Click **Install**, then add the component to your active theme(s)
   (**Components** tab of the theme → **Add a component**)

That's it — the Listen player appears at the top of every post.

## Settings

All settings are configurable per theme under **Admin → Appearance → Themes and
components → TTS Listen Button → Settings**:

| Setting                   | Default | Description                                                                                       |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `default_rate`            | `1`     | Default playback speed. The drop-down offers `0.1`–`2.0` in `0.1` steps; the setting shares that range. |
| `default_voice`           | `auto`  | Preferred voice **language**, chosen from a drop-down (e.g. `de` or `de-DE`). `auto` follows the platform's default language. |
| `show_voice_selector`     | `true`  | Show a dropdown with the device's available voices, grouped by language.                          |
| `skip_code_blocks`        | `true`  | Don't read out code blocks.                                                                        |
| `skip_quotes`             | `false` | Don't read out quoted posts.                                                                       |
| `show_unsupported_notice` | `false` | Show a notice instead of hiding the player when the browser has no text-to-speech support at all. |
| `show_no_voice_notice`    | `true`  | Show a small inline notice when no installed voice speaks the configured language, and let the visitor pick one from the drop-down (otherwise the player just stays idle). |

There is no `fallback_voice` setting anymore: a second configured language used
to switch the visitor's language silently, which the team considers worse than
an honest notice. Existing installations are migrated to `auto`. See
[ADR 0006](docs/adr/0006-voice-selection-redesign.md).

### How the voice is chosen

The settings pick a **language**, not a specific voice: voice names differ
between browsers and devices (`Google Deutsch` on Chrome vs `Anna` on macOS vs
`Microsoft Katja` on Windows), while language codes like `de` or `de-DE` are
the same everywhere. Voice `lang` codes are normalized before matching
(underscores → hyphens; Firefox's three-letter prefixes like `deu-DEU-f00`
mapped to `de-DE`), so a German voice reported as `de_DE` is still found.

The selection ladder, in order ([ADR 0006](docs/adr/0006-voice-selection-redesign.md)):

1. **The visitor's persisted override** (`tts_listen_voice` in
   `localStorage`, stored as a `{lang, name}` identity). Matched by exact
   identity first, then by any voice of that language. A visitor's own choice
   always wins; picking **"Default (admin)"** in the drop-down clears it and
   re-runs this ladder, so a later admin change is picked up again.
2. **`default_voice`** — the admin's configured language, but only when it is
   not `auto`. Matched by exact code first, then by language family (so `de`
   matches `de-DE`, `de-AT`, …).
3. **The platform's default language** (`document.documentElement.lang` — the
   Discourse site locale), but **only when `default_voice` is `auto`**. A
   configured default that has no voice never silently swaps to the platform's
   language; it falls through to the browser languages instead.
4. **`navigator.languages`**, in preference order, each matched against real,
   normalized voices. This is the spec-recommended visitor-preference signal
   (`Accept-Language`), and it is safe at the terminal because every admin and
   platform option has already failed.
5. **No voice.** The ladder deliberately does **not** fall back to
   `speechSynthesis.getVoices()[0]` — its order and value are unspecified and
   inconsistent across implementations. Instead the player shows the
   no-voice notice (when `show_no_voice_notice` is on), naming the configured
   language the device could not satisfy, and keeps the drop-down usable so
   the visitor can pick a voice themselves.

`auto` (the default) means "no admin preference": it skips step 2 and unlocks
step 3, so a German forum with the admin on `auto` still gets German voices.

Within the resolved language, the component then prefers a **per-platform
recommended voice** from a vendored, curated index ([ADR 0008](docs/adr/0008-per-platform-recommended-voice.md)):
e.g. `Anna` on macOS, `Microsoft Katja - German (Germany)` on Windows, the
veryHigh Edge online voice on Edge. The index is derived from the
[Readium Speech](https://github.com/readium/speech) project and is keyed by
the detected platform (OS/browser). If no recommended voice for the platform is
installed, the player falls back to any voice of the language — today's
behavior — so this only ever improves the default, never breaks it. The admin
still configures only a language; the index is shipped by the component, not
set by the admin.

### Playback speed

The speed drop-down offers `0.1×`–`2.0×` in `0.1` steps (20 options), aligned
with the `default_rate` range, plus a leading **"Default"** entry. The chosen
rate is persisted per-browser (`tts_listen_rate` in `localStorage`) with the
same revert semantics as the voice override: selecting "Default" clears the
stored rate and the player falls back to `default_rate`. Changing speed
mid-playback restarts the current chunk at the new rate. See
[ADR 0007](docs/adr/0007-speed-dropdown-and-persistence.md).

## Browser support

| Browser             | Support | Notes                                                          |
| ------------------- | ------- | -------------------------------------------------------------- |
| Chrome/Edge desktop | ✅      | Best voice selection                                           |
| Chrome Android      | ✅      | Uses Google TTS voices. **Phantom voices** — see caveat below. |
| Firefox             | ✅      | Voices depend on the OS                                        |
| Safari macOS        | ✅      | Good voices                                                    |
| Safari iOS          | ⚠️      | Works; pause can be flaky — use Stop                           |
| No TTS support      | —       | Button hidden (or optional notice shown)                       |

### Caveat: Chrome Android phantom voices

Chrome Android's `speechSynthesis.getVoices()` returns an **unfiltered** list:
it lists languages whose voice packs are *not* installed, so "a voice for
language X is listed" does not mean "language X can actually be spoken". The
matcher normalizes codes and works against the real list, so on desktop and iOS
the no-voice notice is fully reliable. On Chrome Android a `de-DE` voice may be
"found" and selected even when its pack is not installed, and the engine may
then misbehave — so on Android the notice is best-effort rather than
guaranteed. This is documented openly rather than hidden; see
[ADR 0006](docs/adr/0006-voice-selection-redesign.md).

## Development

Clone the repo, install the tooling, and run the linters (Node ≥ 22 and pnpm):

```bash
pnpm install
pnpm lint        # check
pnpm lint:fix    # auto-fix
```

For live development against a Discourse instance, use the official
[`discourse_theme`](https://github.com/discourse/discourse_theme) CLI:

```bash
gem install discourse_theme
discourse_theme watch .
```

## Contributing

Issues and pull requests are welcome. Please keep changes small and in the
spirit of this project: simple, dependency-free, on-device.

## Roadmap

- [x] Translations via theme translations (`locales/*.yml`, currently English and German)
- "Listen to whole topic" mode
- Word-level highlighting via boundary events
- Optional server plugin to pre-generate MP3s with a cloud TTS

## License

[MIT](LICENSE) — © Mehdi Roshan Fekr (Amenein)
