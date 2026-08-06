# Empfohlene Stimme pro Plattform: kuratierte Namenspräferenz innerhalb der aufgelösten Sprache

**Status:** Akzeptiert. Ergänzt [ADR 0005](0005-voice-settings-are-language-codes.md).
Berührt die Leiter von [ADR 0006](0006-voice-selection-redesign.md) nicht.

## Kontext

ADR 0005 hat die Stimmen-*Einstellungen* zu Sprachcodes gemacht und das
Pinnen eines konkreten Stimmmnamens für „bewusst nicht angestrebt" erklärt,
da Stimnnamen je Browser, Betriebssystem und Gerät abweichen und sich mit
BS-Updates ändern. Besucher können weiterhin eine konkrete Stimme im
Drop-down wählen (als `{lang, name}`-Identität gespeichert, ADR 0006), aber
die *automatische* Vorgabe — die Stimme, die verwendet wird, wenn der
Besucher nichts gewählt hat — ist „welche Gerätestimme der aufgelösten
Sprache zuerst entspricht", also der erste Eintrag von `getVoices()` für diese
Sprache. Diese Reihenfolge ist von der Spezifikation nicht festgelegt und
unterscheidet sich je Browser, sodass unter den mehreren deutschen Stimmen
eines Geräts (Anna, Hedda, Google Deutsch, …) die automatische Vorgabe
effektiv zufällig und häufig die roboterhafte ist.

Die Recherche (siehe `docs/research/0002-per-platform-voice-names.md`)
bestätigt, dass es keinen Stimmmnamen gibt, der auf mehr als einer
Plattformfamilie existiert: „Anna" gibt es nur bei Apple, „Microsoft Hedda -
German (Germany)" nur unter Windows, „Google Deutsch" nur auf Chrome
Desktop, und Android meldet Stimmen unter Namen wie
`Android Speech Recognition and Synthesis from Google de-de-x-dea-network`.
Ein Admin, der einen Namen pinnt, pinnt eine Stimme, die auf jeder anderen
Plattform fehlt.

Dieselbe Recherche fand, dass das Readium-Speech-Projekt
(`github.com/readium/speech`, Nachfolger von
`HadrienGardeur/web-speech-recommended-voices`) pro Sprache eine kuratierte
Liste empfohlener Stimmen pflegt, die genau die Felder trägt, die eine
plattformspezifische Vorgabe braucht: `name`, `altNames` (Android-Aliasse),
`localizedName: "apple"` (macOS lokalisiert Stimnnamen nach System-Locale),
`os`, `browser`, `quality`, `preloaded`. Das ist eine gepflegte
pro-Geräte-Vorgabestimmen-Tabelle.

## Entscheidung

1. **Der Admin konfiguriert weiterhin nur eine Sprache** (`default_voice`),
   wie in ADR 0005/0006. Es wird keine Einstellung hinzugefügt, entfernt oder
   migriert.
2. **Die Komponente liefert einen vendoring-kompakten Index empfohlener
   Stimmen** aus Readium Speech, für einen Kernbestand der Sprachen im
   `default_voice`-Enum (`de en fr es it pt nl`). Sprachen außerhalb des
   Index fallen graceful auf das heutige Verhalten zurück (irgendeine Stimme
   der Sprache, Invariante I1); der Bestand kann erweitert werden. Jeder
   Eintrag ist `{name, altNames, localizedName, os, browser,
   quality, preloaded}`; umfangreiche Felder (`testUtterance`, `pitch`,
   `rate`, `note`) entfallen. Eine Refresh-Notiz
   (`docs/research/0002-refresh-recommended-voices.md`) dokumentiert die
   Neu-Erzeugung.
3. **Ein neuer reiner Schritt `preferRecommendedVoice` ordnet um, welche
   Stimme der aufgelösten Sprache gewählt wird**; er ändert nicht, welche
   Sprache aufgelöst wird. `findForLang` wird aufgeteilt in „alle Stimmen
   dieser Sprache sammeln (exakt dann Familie, dedupliziert)" und „die beste
   wählen"; der Wähler wendet die Empfehlung an und fällt auf die erste
   gesammelte Stimme (heutiges Verhalten) zurück, wenn kein empfohlener Name
   installiert ist.
4. **Die Empfehlung gilt an jeder sprachauflösenden Leiterstufe** — Admin-
   Vorgabe, Plattformsprache, Browsersprachen —, da alle „eine Stimme für
   Sprache X" auflösen. Der Besucher-Override (`{lang, name}`) ist namensbasiert
   und unverändert; er gewinnt immer.
5. **Reihenfolge innerhalb einer Sprache:** zuerst Regions-Treffer (die
   angefragte Region bzw. die `defaultRegion` der Tabelle, wenn der Admin
   einen bloßen Familiencode gesetzt hat, z. B. `de` → `de-DE`-Stimmen
   bevorzugen), dann `preloaded: true`, dann `quality` (`veryHigh` > `high`
   > `normal` > `low`), dann `localService` (offline) als Tie-Breaker, dann
   Indexreihenfolge.
6. **Matching übersteht Plattform-Eigenheiten:** eine empfohlene Stimme
   passt auf eine Gerätestimme, wenn deren `name` gleich dem empfohlenen
   `name` ist **oder** in `altNames` steht, jeweils case-insensitiv gegen
   Vendor-Groß-/Kleinschreibung (z. B. „Google Deutsch" vs. „Google
   deutsch"). `localizedName: "apple"` ist eine reine
   Dokumentations-Markierung: der Wähler matcht auf den kanonischen `name`,
   den aktuelle Apple-Stimmen unabhängig von der System-Locale unverändert
   zurückgeben; eine Abfrage lokalisierter Namen findet nicht statt.
7. **Plattform-Erkennung** ist eine grobe `navigator`-basierte Abbildung auf
   Readiums `os`/`browser`-Tags (`macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/
   `ChromeOS`, `Edge`/`ChromeDesktop`). Sie ist ein Best-Effort-Filter, nicht
   autoritativ; eine empfohlene Stimme ohne `os`/`browser` gilt überall als
   verfügbar.

## Konsequenzen

- **ADR 0005 wird ergänzt, nicht umgekehrt.** Der Admin pinnt keinen
  Stimmmnamen (weiterhin out of scope); die *Komponente* pinnt eine kuratierte,
  plattformspezifische Namenspräferenz aus einer gepflegten Tabelle. ADR
  0006s Leiter, die Auto-gates-Platform-Regel und der No-Voice-Hinweis bleiben
  unangetastet.
- **Keine Einstellung, keine Migration.** Keine Änderung an `settings.yml`,
  Locales oder Migration. Das vermeidet die Ausfallklasse, die PR #26
  verursachte.
- **Android-Ehrlichkeit unverändert.** Chrome Android liefert eine
  *ungefilterte* Stimmenliste inklusive Stimmen, deren Packs nicht installiert
  sind; ein empfohlener Name kann auf eine Phantomstimme passen, die nicht
  tatsächlich sprechen kann. Der No-Voice-Hinweis bleibt auf Android
  Best-Effort, wie in ADR 0006. Die Empfehlung ist eine Verfeinerung für
  Desktop und iOS, kein Android-Fix.
- **Snapshot-Pflege.** Der vendoring-Index ist ein Snapshot, der veraltet,
  wenn Apple/Google/Microsoft Stimmen ausliefern. Die Refresh-Notiz
  (`docs/research/0002-refresh-recommended-voices.md`) und ein
  Release-Checklisten-Eintrag dokumentieren die Neu-Erzeugung; regenerierte
  Snapshots müssen schlank bleiben (nur die behaltenen Felder), da der Index
  jedem Besucher ausgeliefert wird (ADR 0003), und kompakt, damit Review
  machbar bleibt.
- **Besucher-Override gewinnt weiterhin.** Ein Besucher, der im Drop-down
  eine Stimme wählt, wird nie durch die Empfehlung überstimmt.

## Betrachtete Optionen

- **Admin-Freitext-Hint `default_voice_name` mit grudosem Verfall.** Abgelehnt:
  führt die ADR-0005-Fragilität wieder ein (Admin pinnt blind zum Gerät des
  Besuchers einen Namen) und kann Apple-Locale-Varianten oder Android-Aliasse
  nicht pflegen. Die kuratierte Tabelle erledigt beides.
- **Runtime-Fetch des Readium-JSON.** Abgelehnt: verletzt das
  Selbstenthaltungs-Prinzip des Theme-Components (ADR 0003), erzeugt eine
  Netzwerk-/Privacy-Abhängigkeit und einen Ausfallmodus bei jedem
  Seitenaufruf.
- **Pro-Plattform-Admin-Einstellungen (`default_voice_name_macos`, …).**
  Abgelehnt: Einstellungs-Explosion; der Admin kennt die Stimnnamen jeder
  Plattform ebenso wenig. Die Tabelle ist die gepflegte Form dieser Idee.
- **Hartes Pinnen (empfohlener Name oder No-Voice-Hinweis).** Abgelehnt: ein
  fehlender empfohlener Name würde einen Beitrag stummschalten, der weitere
  nutzbare Stimmen der Sprache hat. Die Empfehlung verfällt stattdessen auf
  „irgendeine Stimme der Sprache".