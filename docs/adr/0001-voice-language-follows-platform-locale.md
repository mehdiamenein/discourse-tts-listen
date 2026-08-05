# Voice language follows the platform's default language, not the visitor's browser

**Status:** Amended by [ADR 0006](0006-voice-selection-redesign.md). The
platform language remains the primary signal; the browser language
(`navigator.languages`) is now consulted as a guarded terminal step only.

The TTS player picks its starting voice by language, and that language is the
Discourse site's default (`document.documentElement.lang`), not the visitor's
browser locale (`navigator.language`). This project serves a German-first
community; the forum's language is the authoritative signal, so German voices
win even when a visitor's browser is English. Reversing this (e.g. "fixing" it
to browser locale) would break German-first behavior on English-default
browsers.
