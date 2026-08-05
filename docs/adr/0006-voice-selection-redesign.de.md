# Neugestaltung der Stimmenauswahl: Fallback-Einstellung entfernen, Codes normalisieren, Hinweis statt sprachlosem Wechsel

**Status:** Angenommen. Ändert ADR 0001 ab. Löst das Zwei-Einstellungen-Modell
aus ADR 0005 (`default_voice` + `fallback_voice`) durch eine einzige
Einstellung `default_voice` ab.

## Kontext

Ein Kunde unter Android erhielt standardmäßig indische (hi-IN / en-IN)
Text-to-Speech-Stimmen, obwohl der Administrator Deutsch konfiguriert hatte, in
einem deutschen Forum, mit beiden Einstellungen `default_voice` und
`fallback_voice` gesetzt. Die Auswahlliste fiel lautlos durch jede Stufe und
landete bei `speechSynthesis.getVoices()[0]` — der ersten Geräte-Stimme — die
unter Chrome Android nicht spezifiziert und häufig eine indisch-englische oder
hindi Stimme ist.

Die Untersuchung (siehe `docs/research/0001-android-voice-selection-bug.md`)
fand drei sich überlagernde Ursachen:

1. **Chrome Android meldet eine ungefilterte Stimmliste.** `getVoices()` gibt
   Sprachen/Regionen zurück, deren Sprachpakete nicht installiert sind; „eine
   Stimme für Sprache X ist gelistet" bedeutet also nicht „Sprache X kann
   tatsächlich gesprochen werden".
2. **`lang`-Codes der Stimmen sind nicht einheitlich mit Bindestrich.** Android
   verwendet Unterstriche (`de_DE`); Firefox verwendet dreibuchstabige Präfixe
   (`deu-DEU-f00`). Der Matcher verglich mit `startsWith("de-")`, sodass eine
   deutsche Stimme als `de_DE` oder `deu-DEU-f00` nie zu `default_voice: de`
   passte. Die Einstellung des Administrators war korrekt; der Matcher konnte
   die installierte deutsche Stimme nur nicht sehen.
3. **`list[0]` und `voice.default` sind unzuverlässige letzte Ausweichoptionen.**
   Reihenfolge und Wert sind nicht spezifiziert oder implementierungsabhängig.

## Entscheidung

1. **Die Einstellung `fallback_voice` wird entfernt.** Es gibt keinen lautlosen
   Fallback auf eine Zweitsprache. Bestehende Installationen werden zu `auto`
   migriert.
2. **Jeder `lang`-Code wird vor dem Abgleich normalisiert** (`_` → `-`; `deu-DEU-f00`-Präfixe
   entfernen). Allein das löst die Kundenbeschwerde auf Desktop und iOS.
3. **`list[0]` wird nie als letzte Ausweichoption verwendet.** Die
   Auswahlliste: Benutzer-Override → `default_voice` → Plattformsprache (nur
   wenn `default` `auto` ist) → `navigator.languages`, abgeglichen gegen reale,
   normalisierte Stimmen → Stopp und Anzeige des Keine-Stimme-Hinweises.
4. **Ein Keine-Stimme-Hinweis wird angezeigt**, statt lautlos die Sprache zu
   wechseln. Wenn keine Stimme die konfigurierte Sprache spricht, zeigt der
   Player eine kleine, nicht schließbare Inline-Warnung (über Theme-Übersetzungen
   lokalisiert), die genau sagt, was fehlt, und dass eine andere Stimme im
   Dropdown gewählt werden kann. Jeden Sprachwechsel entscheidet der Besucher;
   die Komponente entscheidet ihn nie.
5. **Der Benutzer-Override wird als Stimmen-Identität `{lang, name}`** in
   `localStorage` gespeichert, forumweit, beim Laden aufgelöst als: exakte
   Stimme → beliebige Stimme dieser Sprache → die automatische Leiter. „Default"
   im Dropdown löscht den Override (Revert), sodass spätere
   Administratoränderungen automatisch übernommen werden.
6. **`navigator.languages` nur als letzte automatische Stufe.** Es ist das vom
   Standard empfohlene Signal für die Besuchervorliebe (`Accept-Language`) und
   am Ende sicher — alle Administrator- und Plattformoptionen sind bereits
   gescheitert, also hat das Gerät ohnehin keine Stimme für die konfigurierte
   Sprache.

## Abgewogene Optionen

- **`fallback_voice` behalten und umbenennen.** Abgelehnt: eine zweite
  konfigurierte Sprache wechselt die Besuchersprache weiterhin lautlos, was das
  Team für schlechter hält als einen ehrlichen Hinweis. Die Einstellung
  duplizierte zudem die Frage „was tun, wenn die bevorzugte Sprache keine Stimme
  hat", die der Hinweis nun direkt beantwortet.
- **Lautloser Fallback auf `en-US`.** Abgelehnt: für ein Open-Source-Release
  voreingenommen, ignoriert die Vorliebe des Besuchers und ist genau die
  intransparente Art Wechsel, die zur ursprünglichen Beschwerde führte.
- **Player ganz verbergen, wenn keine konfigurierte Stimme passt.** Abgelehnt:
  ein Besucher, dessen Gerät nur das Sprachpaket des Forums fehlt, würde
  Text-to-Speech verlieren, selbst wenn andere nutzbare Stimmen existieren. Der
  Hinweis hält das Dropdown nutzbar.

## Konsequenzen

- **Ehrlicher Android-Vorbehalt.** Weil Chrome Android Phantom-Stimmen listet,
  kann eine `de-DE`-Stimme „gefunden" und gewählt werden, obwohl ihr Paket nicht
  installiert ist; die Engine kann sich dann falsch verhalten. Der
  Keine-Stimme-Hinweis ist auf Desktop und iOS voll zuverlässig, unter Android
  nach bestem Bemühen. Das wird offen dokumentiert, nicht verschwiegen.
- **ADR 0001 wird abgeändert, nicht umgekehrt.** Die Plattformsprache bleibt das
  primäre Signal; die Browsersprache wird nur als abgesicherte letzte Stufe
  hinzugefügt. Die Deutsch-zuerst-Garantie (ein deutsches Forum mit
  Administrator auf `auto` erhält Deutsch) bleibt bestehen.
- **Eine Einstellung entfernt, eine hinzugefügt.** `fallback_voice` wird
  entfernt (Migration `0002-…`); `show_no_voice_notice` wird hinzugefügt
  (Standard `true`).
- **Das Dropdown ändert sich.** Es listet Geräte-Stimmen nach Sprache
  gruppiert, mit einer „Default (Administrator)"-Option, die den Override
  zurücksetzt. Stimmwahlen werden als Identitäten gespeichert, nicht als Index.