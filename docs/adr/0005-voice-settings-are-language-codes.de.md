# Stimmen-Einstellungen sind Sprach-Codes aus einem Dropdown, keine Freitext-Namen

**Status:** Geändert durch [ADR 0008](0008-per-platform-recommended-voice.de.md).
Der Admin konfiguriert weiterhin nur eine Sprache; die konkrete Stimme
*innerhalb* dieser Sprache wird nun pro Plattform aus einem von der Komponente
mitgelieferten, kuratierten empfohlenen Stimmen-Index gewählt.

Die Theme-Einstellungen `default_voice` und `fallback_voice` sind `enum`-
Dropdowns von Sprach-Codes (BCP 47, z. B. `de`, `de-DE`, `en-US`), wobei `auto`
„keine Präferenz" bedeutet. Der Player gleicht einen Einstellungs-Wert nach
Sprache an Gerätestimmen ab — exakter Code zuerst, dann Sprachfamilie — und
niemals gegen Stimmennamen.

Früher waren diese Einstellungen Freitext-Strings, die per Teilstring gegen
sowohl den Stimmennamen als auch die Sprache abgeglichen wurden, sodass Admins
eine konkrete Stimme pinnen konnten („Google Deutsch"). Das war fragil:
Stimmennamen unterscheiden sich je Browser, OS und Gerät und ändern sich mit
OS-Updates, sodass ein gepinnter Name für die meisten Besucher stumm scheiterte.
Sprach-Codes sind universell, und die Gerätestimmen-Liste ist Besuchern bereits
über das `show_voice_selector`-Dropdown zugänglich, sodass der Admin nur noch
eine Sprach-Präferenz ausdrücken muss. Eine konkrete Stimme zu pinnen ist
bewusst nicht Teil des Umfangs.

Der Wechsel des Einstellungs-Typs von string zu enum liefert eine
Settings-Migration mit
(`migrations/settings/0001-voice-settings-to-language-enum.js`), damit
bestehende Installationen nicht kaputtgehen: gespeicherte Sprach-Codes bleiben,
alles andere (Stimmennamen, leere Werte) mappt auf `auto`.