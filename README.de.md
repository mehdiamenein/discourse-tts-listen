# TTS-Anhören-Button für Discourse

[![Discourse Theme CI](https://github.com/mehdiamenein/discourse-tts-listen/actions/workflows/discourse-theme.yml/badge.svg)](https://github.com/mehdiamenein/discourse-tts-listen/actions/workflows/discourse-theme.yml)

Eine einfache [Discourse](https://www.discourse.org/)-Theme-Komponente, die
jedem Beitrag eine barrierefreie **Schaltfläche „Anhören"** hinzufügt, angetrieben
von der im Browser integrierten Text-to-Speech-Funktion (Web Speech API). 100 %
auf dem Gerät: keine externen Dienste, keine API-Schlüssel, keine Audiodateien,
keine Preisgabe von Daten.

## Warum es diese Komponente gibt

Wir haben sie für unsere eigene Community gebaut, damit Mitglieder lange Beiträge
anhören können, statt sie zu lesen — ein kleiner Gewinn an Barrierefreiheit und
Komfort. Es ist eine bewusst einfache Lösung: eine Theme-Komponente, keine
Plugins, keine Server, keine Kosten. Wir veröffentlichen sie als Open Source
unter der MIT-Lizenz in der Hoffnung, dass sie auch anderen Communities ein
wenig hilft. Nutze sie, forke sie, verbessere sie.

## Funktionen

- Erkennt `speechSynthesis`-Unterstützung und rendert den Player nur, wenn sie
  verfügbar ist
- Liest nur den Beitragsinhalt vor — nie Navigation oder UI-Chrome
- Abspielen / Pausieren / Fortsetzen / Stopp, ein Geschwindigkeits-Dropdown und
  eine optionale Stimmenauswahl
- Eine **einzelne bevorzugte Stimmen-Sprache** (kein Fallback auf eine
  Zweitwahl): wenn das Gerät keine Stimme dafür hat, sagt der Player es ehrlich,
  statt lautlos die Sprache zu wechseln
- Die Vorlese-Sprache folgt der **Standard-Sprache der Plattform**
  (Discourse-Locale), nicht dem Browser des Besuchers — deutschsprachige
  Communities erhalten automatisch deutsche Stimmen (wenn die Administration die
  Standardeinstellung auf `auto` belässt)
- Die eigenen Stimmen- und Geschwindigkeitswahlen eines Besuchers werden **pro
  Browser gespeichert** und gewinnen immer; das Wählen von „Standard" setzt auf
  die Administrator-Einstellung zurück, sodass eine spätere Änderung wieder
  übernommen wird
- Die Player-Steuerung wird **über Theme-Übersetzungen lokalisiert** (Deutsch
  auf deutschen Foren, Englisch auf englischen Foren); Englisch ist der
  Fallback
- **Liest weiter, während du scrollst** — Beiträge, die Discourse beim
  Scrollen aus dem Sichtbereich und zurück neu rendert, schneiden die Stimme
  nie mitten im Satz ab
- Hebt den Absatz hervor, der gerade vorgelesen wird
- Per Tastatur bedienbar, sichtbare Fokus-Zustände, `aria-live`-Statusmeldungen
- Spielt nie automatisch ab; die Sprachausgabe stoppt, wenn du wegnavigierst
- Teilt lange Absätze an Satzgrenzen, um Browser-Abbrüche zu vermeiden
- Überspringt Codeblöcke und/oder Zitate (konfigurierbar)
- Keine Template-Overrides — reines `decorateCookedElement`, erbt das Design
  deines Themes über Discourse-CSS-Variablen

## Voraussetzungen

- Discourse **3.2.0** oder neuer
- Ein Browser mit Web-Speech-API-Unterstützung (siehe Tabelle unten)

## Installation

1. Gehe zu **Administration → Erscheinungsbild → Designs und Komponenten →
   Installieren → Aus einem Git-Repository**
2. Füge ein: `https://github.com/mehdiamenein/discourse-tts-listen`
3. Klicke auf **Installieren**, füge die Komponente dann deinen aktiven Designs
   hinzu (**Komponenten**-Tab des Designs → **Komponente hinzufügen**)

Das war's — der Anhören-Player erscheint oben an jedem Beitrag.

## Einstellungen

Alle Einstellungen sind pro Design konfigurierbar unter **Administration →
Erscheinungsbild → Designs und Komponenten → TTS Listen Button →
Einstellungen**:

| Einstellung               | Standard | Beschreibung                                                                                                                                                                                                            |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default_rate`            | `1`      | Standard-Abspielgeschwindigkeit. Das Dropdown bietet `0,1`–`2,0` in `0,1`-Schritten; die Einstellung teilt diesen Bereich.                                                                                              |
| `default_voice`           | `auto`   | Bevorzugte Stimmen-**Sprache**, gewählt aus einem Dropdown (z. B. `de` oder `de-DE`). `auto` folgt der Standard-Sprache der Plattform.                                                                                  |
| `show_voice_selector`     | `true`   | Ein Dropdown mit den auf dem Gerät verfügbaren Stimmen anzeigen, nach Sprache gruppiert.                                                                                                                                |
| `skip_code_blocks`        | `true`   | Codeblöcke nicht vorlesen.                                                                                                                                                                                              |
| `skip_quotes`             | `false`  | Zitierte Beiträge nicht vorlesen.                                                                                                                                                                                       |
| `show_unsupported_notice` | `false`  | Einen Hinweis anzeigen statt den Player zu verbergen, wenn der Browser gar keine Text-to-Speech-Unterstützung hat.                                                                                                      |
| `show_no_voice_notice`    | `true`   | Einen kleinen Inline-Hinweis anzeigen, wenn keine installierte Stimme die konfigurierte Sprache spricht, und die Besucherin eine Stimme aus dem Dropdown wählen lassen (andernfalls bleibt der Player einfach inaktiv). |

Eine `fallback_voice`-Einstellung gibt es nicht mehr: eine zweite konfigurierte
Sprache wechselte die Besuchersprache lautlos, was das Team für schlechter hält
als einen ehrlichen Hinweis. Bestehende Installationen werden zu `auto`
migriert. Siehe [ADR 0006](docs/adr/0006-voice-selection-redesign.de.md).

### Wie die Stimme gewählt wird

Die Einstellungen wählen eine **Sprache**, keine bestimmte Stimme: Stimmennamen
unterscheiden sich zwischen Browsern und Geräten (`Google Deutsch` unter Chrome
vs `Anna` unter macOS vs `Microsoft Katja` unter Windows), während Sprach-Codes
wie `de` oder `de-DE` überall gleich sind. Die `lang`-Codes der Stimmen werden
vor dem Abgleich normalisiert (Unterstriche → Bindestrich; Firefox'
dreibuchstabige Präfixe wie `deu-DEU-f00` zu `de-DE` abgebildet), sodass eine
deutsche Stimme, die als `de_DE` gemeldet wird, trotzdem gefunden wird.

Die Auswahlliste, in dieser Reihenfolge
([ADR 0006](docs/adr/0006-voice-selection-redesign.de.md)):

1. **Der gespeicherte Override des Besuchers** (`tts_listen_voice` in
   `localStorage`, als `{lang, name}`-Identität gespeichert). Zuerst nach
   exakter Identität abgeglichen, dann nach beliebiger Stimme dieser Sprache.
   Die eigene Wahl des Besuchers gewinnt immer; das Wählen von
   **„Standard (Admin)"** im Dropdown löscht sie und durchläuft diese Leiter
   erneut, sodass eine spätere Administratoränderung wieder übernommen wird.
2. **`default_voice`** — die vom Administrator konfigurierte Sprache, aber nur
   wenn sie nicht `auto` ist. Zuerst nach exaktem Code abgeglichen, dann nach
   Sprachfamilie (sodass `de` zu `de-DE`, `de-AT`, … passt).
3. **Die Standard-Sprache der Plattform** (`document.documentElement.lang` —
   die Discourse-Site-Locale), aber **nur wenn `default_voice` `auto` ist**.
   Ein konfigurierter Standard, der keine Stimme hat, wechselt niemals lautlos
   zur Plattformsprache; er fällt stattdessen zu den Browsersprachen durch.
4. **`navigator.languages`**, in Bevorzugungsreihenfolge, jede abgeglichen
   gegen reale, normalisierte Stimmen. Dies ist das vom Standard empfohlene
   Signal für die Besuchervorliebe (`Accept-Language`), und am Ende sicher,
   weil jede Administrator- und Plattformoption bereits gescheitert ist.
5. **Keine Stimme.** Die Leiter fällt bewusst **nicht** auf
   `speechSynthesis.getVoices()[0]` zurück — Reihenfolge und Wert sind nicht
   spezifiziert und über Implementierungen hinweg inkonsistent. Stattdessen
   zeigt der Player den Keine-Stimme-Hinweis an (wenn `show_no_voice_notice` an
   ist), nennt die konfigurierte Sprache, die das Gerät nicht bedienen konnte,
   und hält das Dropdown nutzbar, sodass der Besucher selbst eine Stimme wählen
   kann.

`auto` (die Standardeinstellung) bedeutet „keine Administrator-Vorliebe": es
überspringt Schritt 2 und gibt Schritt 3 frei, sodass ein deutsches Forum mit
der Administration auf `auto` trotzdem deutsche Stimmen erhält.

### Abspielgeschwindigkeit

Das Geschwindigkeits-Dropdown bietet `0,1×`–`2,0×` in `0,1`-Schritten (20
Optionen), ausgerichtet am `default_rate`-Bereich, plus einem führenden
**„Standard"**-Eintrag. Die gewählte Rate wird pro Browser gespeichert
(`tts_listen_rate` in `localStorage`) mit denselben Revert-Regeln wie der
Stimmen-Override: das Wählen von „Standard" löscht die gespeicherte Rate und der
Player fällt auf `default_rate` zurück. Ein Geschwindigkeitswechsel während der
Wiedergabe startet den aktuellen Block mit der neuen Rate neu. Siehe
[ADR 0007](docs/adr/0007-speed-dropdown-and-persistence.de.md).

## Browser-Unterstützung

| Browser                 | Unterstützung | Hinweise                                                               |
| ----------------------- | ------------- | ---------------------------------------------------------------------- |
| Chrome/Edge Desktop     | ✅            | Beste Stimmenauswahl                                                   |
| Chrome Android          | ✅            | Nutzt Google-TTS-Stimmen. **Phantom-Stimmen** — siehe Vorbehalt unten. |
| Firefox                 | ✅            | Stimmen hängen vom Betriebssystem ab                                   |
| Safari macOS            | ✅            | Gute Stimmen                                                           |
| Safari iOS              | ⚠️            | Funktioniert; Pause kann unzuverlässig sein — Stopp verwenden          |
| Keine TTS-Unterstützung | —             | Schaltfläche verborgen (oder optionaler Hinweis angezeigt)             |

### Vorbehalt: Phantom-Stimmen unter Chrome Android

`speechSynthesis.getVoices()` unter Chrome Android gibt eine **ungefilterte**
Liste zurück: es listet Sprachen, deren Sprachpakete _nicht_ installiert sind,
sodass „eine Stimme für Sprache X ist gelistet" nicht bedeutet „Sprache X kann
tatsächlich gesprochen werden". Der Matcher normalisiert Codes und arbeitet
gegen die reale Liste, sodass der Keine-Stimme-Hinweis auf Desktop und iOS voll
zuverlässig ist. Unter Chrome Android kann eine `de-DE`-Stimme „gefunden" und
gewählt werden, obwohl ihr Paket nicht installiert ist, und die Engine kann
sich dann falsch verhalten — daher ist der Hinweis unter Android nach bestem
Bemühen statt garantiert. Das wird offen dokumentiert, nicht verschwiegen;
siehe [ADR 0006](docs/adr/0006-voice-selection-redesign.de.md).

## Entwicklung

Klone das Repo, installiere die Werkzeuge und führe die Linter aus (Node ≥ 22
und pnpm):

```bash
pnpm install
pnpm lint        # prüfen
pnpm lint:fix    # automatisch beheben
```

Für die Live-Entwicklung gegen eine Discourse-Instanz verwende das offizielle
[`discourse_theme`](https://github.com/discourse/discourse_theme)-CLI:

```bash
gem install discourse_theme
discourse_theme watch .
```

## Mitwirken

Issues und Pull Requests sind willkommen. Bitte halte Änderungen klein und im
Geist dieses Projekts: einfach, abhängigkeitsfrei, auf dem Gerät.

## Roadmap

- [x] Übersetzungen über Theme-Übersetzungen (`locales/*.yml`, derzeit Englisch
      und Deutsch)
- Modus „Ganzes Thema anhören"
- Wortgenaues Hervorheben über Boundary-Events
- Optionales Server-Plugin, das MP3s mit einem Cloud-TTS vorab erzeugt

## Lizenz

[MIT](LICENSE) — © Mehdi Roshan Fekr (Amenein)
