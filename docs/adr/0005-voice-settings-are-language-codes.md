# Voice settings are language codes from a drop-down, not free-text names

**Status:** Amended by [ADR 0008](0008-per-platform-recommended-voice.md). The
admin still configures only a language; the specific voice *within* that
language is now chosen per platform from a curated recommended-voice index
shipped by the component.

The `default_voice` and `fallback_voice` theme settings are `enum` drop-downs
of language codes (BCP 47, e.g. `de`, `de-DE`, `en-US`), with `auto` meaning
"no preference". The player matches a setting value against device voices by
language — exact code first, then language family — and never against voice
names.

Previously these settings were free-text strings matched by substring against
both the voice name and language, so admins could pin a specific voice
("Google Deutsch"). That was fragile: voice names differ per browser, OS and
device and change with OS updates, so a pinned name silently failed for most
visitors. Language codes are universal, and the on-device voice list is
already exposed to visitors through the `show_voice_selector` drop-down, so
admins only need to express a language preference. Pinning one exact voice is
deliberately out of scope.

Changing the setting type from string to enum ships with a settings migration
(`migrations/settings/0001-voice-settings-to-language-enum.js`) so existing
installations don't break: stored language codes are kept, everything else
(voice names, empty values) maps to `auto`.
