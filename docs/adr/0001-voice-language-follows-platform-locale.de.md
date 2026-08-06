# Die Stimmen-Sprache folgt der Plattform-Standardsprache, nicht der Browser-Sprache des Besuchers

**Status:** Geändert durch [ADR 0006](0006-voice-selection-redesign.de.md). Die
Plattformsprache bleibt das primäre Signal; die Browsersprache
(`navigator.languages`) wird nur als abgesicherte letzte Stufe berücksichtigt.

Der TTS-Player wählt seine Startstimme nach Sprache, und diese Sprache ist die
Standard-Sprache der Discourse-Site (`document.documentElement.lang`), nicht die
Browser-Locale des Besuchers (`navigator.language`). Dieses Projekt bedient eine
deutsch-zuerst-Community; die Foren-Sprache ist das autoritative Signal, sodass
deutsche Stimmen gewinnen, selbst wenn der Browser des Besuchers auf Englisch
steht. Eine Umkehr davon (z. B. „Korrektur" zur Browser-Locale) würde das
Deutsch-zuerst-Verhalten bei englisch-default Browsern kaputt machen.