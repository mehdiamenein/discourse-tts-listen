# Die Stimmenauswahl liegt in einem reinen Modul, per QUnit in der CI getestet

Die `selectVoice`-Entscheidung — welche Gerätestimme der Player startet — ist
in ein abhängigkeitsfreies Modul
(`javascripts/discourse/lib/tts-selection.js`) ausgelagert, sodass es ohne eine
Discourse-Runtime unit-getestet werden kann. Die QUnit-Suite in
`test/javascripts/` läuft nur innerhalb eines Discourse-Containers in der CI;
lokal werden dieselben Assertionen über Node verifiziert. Theme-Tests addressieren
Theme-Module **ohne** das `javascripts/`-Präfix (Discourse schlüsselt sie relativ
zu `javascripts/`) — eine beliebte Fehlerquelle beim Anlegen der nächsten
Testdatei.