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
- Play / pause / resume / stop, playback-speed control, optional voice picker
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

| Setting                   | Default | Description                                          |
| ------------------------- | ------- | ---------------------------------------------------- |
| `default_rate`            | `1`     | Default playback speed (0.5 – 3)                     |
| `show_voice_selector`     | `true`  | Show a dropdown with the device's available voices   |
| `skip_code_blocks`        | `true`  | Don't read out code blocks                           |
| `skip_quotes`             | `false` | Don't read out quoted posts                          |
| `show_unsupported_notice` | `false` | Show a notice instead of hiding the player when TTS is unavailable |

## Browser support

| Browser             | Support | Notes                                    |
| ------------------- | ------- | ---------------------------------------- |
| Chrome/Edge desktop | ✅      | Best voice selection                     |
| Chrome Android      | ✅      | Uses Google TTS voices                   |
| Firefox             | ✅      | Voices depend on the OS                  |
| Safari macOS        | ✅      | Good voices                              |
| Safari iOS          | ⚠️      | Works; pause can be flaky — use Stop     |
| No TTS support      | —       | Button hidden (or optional notice shown) |

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

- "Listen to whole topic" mode
- Word-level highlighting via boundary events
- Translations via theme translations
- Optional server plugin to pre-generate MP3s with a cloud TTS

## License

[MIT](LICENSE) — © Mehdi Roshan Fekr (Amenein)
