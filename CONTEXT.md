# TTS Listen Button

A Discourse theme component that adds an accessible "Listen" button to forum
posts, reading post content aloud with the browser's built-in Web Speech API.
Deliberately simple: one component, no backend, no external services.

## Language

**Listen player**:
The per-post control that plays, pauses, resumes and stops speech.
_Avoid_: widget, player widget, TTS widget

**Block**:
A top-level text element of a post that can be read aloud (`p`, `li`, `h1`–
`h6`, `blockquote`, `td`, `th`, `figcaption`). Elements nested inside another
block are not read separately.
_Avoid_: paragraph, element

**Chunk**:
A sentence-bounded slice of a block that becomes a single speech utterance.
Splitting exists because browsers silently cut off longer utterances.
_Avoid_: utterance, segment (utterance is the Web Speech API's own term; chunk
is ours)

**Platform language**:
The Discourse site's default language — the language the forum is configured
in. Voice selection targets this language, not the visitor's browser locale.
_Avoid_: browser language, site language, locale

**Default voice / Fallback voice**:
The two theme settings that pin a preferred voice, matched against device voice
names or language codes.

**Voice selection priority**:
The order in which the player picks its starting voice: default voice setting →
fallback voice setting → first voice speaking the platform language → first
available device voice.
_Avoid_: voice fallback, voice preference

**Active player**:
The single listen player that may speak at a time. Starting one player stops
any other.
_Avoid_: current player, speaking player
