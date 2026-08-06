# Admin kann pro Plattform einen empfohlenen Stimmennamen aus dem kuratierten Index festlegen

**Status:** Akzeptiert. Ändert [ADR 0005](0005-voice-settings-are-language-codes.md)
und [ADR 0008](0008-per-platform-recommended-voice.md). Berührt die Leiter aus
[ADR 0006](0006-voice-selection-redesign.md) nicht.

## Kontext

ADR 0005 machte Stimmen-*Einstellungen* zu Sprach-Codes und erklärte das
Festlegen eines konkreten Stimmennamens für „bewusst nicht Teil des
Umfangs", weil Stimmennamen je Browser, OS und Gerät variieren und sich mit
OS-Updates ändern, sodass ein festgelegter Name für die meisten Besucher
stumm scheiterte. ADR 0008 lieferte dann einen vendorten, pro-Plform-
empfohlenen Stimmenindex und nutzte ihn *automatisch*, um zu verfeinern, welche
Stimme innerhalb der aufgelösten Sprache gewählt wird — und lehnte dabei
explizit drei admin-seitige Optionen ab:

- **Freitext-Hinweis `default_voice_name` pro Plattform** — führt die
  ADR-0005-Fragilität wieder ein (Admin legt einen Namen blind zum Gerät des
  Besuchers fest).
- **Pro-Plattform-Admin-Einstellungen (`default_voice_name_macos`, …)** —
  „Einstellungs-Explosion; der Admin kennt auch nicht die Stimmennamen jeder
  Plattform. Die Tabelle ist die gepflegte Form dieser Idee."
- **Harte Festlegung (empfohlener Name oder kein-Stimme-Hinweis)** — ein
  fehlender empfohlener Name würde einen Beitrag stummlegen, der andere
  nutzbare Stimmen der Sprache hat.

Die Lücke, die dieser Wechsel schließt, ist real und war der Anlass dafür:
ADR 0008 vendorte tausende Zeilen kuratierter Stimmen-*Namen*, zeigte aber
*keinen* davon dem Admin. Dessen einziger Hebel blieb der Sprach-Code, und die
Entscheidung „welche Stimme innerhalb der Sprache" wurde für ihn, unsichtbar,
getroffen. Vom Admin-Sitz aus änderte der ganze PR nichts Sichtbares, und die
kuratierten Namen, die die Komponente bereits mitliefert, waren nie wählbar.

Genau der Einwand, der pro-Plattform-Admin-Einstellungen in 0008 unmöglich
machte — „der Admin kennt die Stimmennamen jeder Plattform nicht" — ist das,
was der vendorte Index jetzt beseitigt: er *ist* die gepflegte, pro-Plattform-
Liste der Namen, die auf jeder Gerätefamilie existieren. Sie dem Admin als
Auswahlliste anzubieten macht die pro-Plattform-Festlegung ehrlich, nicht blind.

## Entscheidung

1. **Der Admin wählt weiterhin zuerst eine Sprache** (`default_voice`),
   unverändert gegenüber ADR 0005/0006/0008. Diese Einstellung bestimmt,
   *welche Sprache* aufgelöst wird.

2. **Acht neue `enum`-Einstellungen legen einen empfohlenen Stimmen*Namen* pro
   Plattform fest**, eine pro Plattform-Tag, nach dem der vendorte Index
   gegliedert ist: `voice_macos`, `voice_ios`, `voice_ipados`,
   `voice_windows`, `voice_android`, `voice_chromeos`,
   `voice_chrome_desktop`, `voice_edge`. Jede defaults auf `auto` (keine
   Festlegung: die automatische Wahl aus ADR 0008 gilt). Ein konkreter Wert
   ist ein Stimmen*name* aus dem kuratierten Index, formatiert als
   `"<lang>: <name>"`, damit der Admin in einer flachen `enum`-Liste die
   Sprachen unterscheiden kann — Discourse-Theme-`enum`-Auswahlen sind
   statisch, die Liste kann also nicht live auf den gewählten `default_voice`
   neu gegliedert werden.

3. **Die Auswahllisten werden aus dem vendorten Index abgeleitet.**
   `scripts/build-voice-choices.mjs` erzeugt die acht `choices`-Blöcke in
   `settings.yml` aus `tts-recommended-voices.js`, sodass Admin-Dropdown und
   der Index, gegen den ein Besucher gematcht wird, synchron bleiben. Das
   Neugenerieren der Auswahl ist nun ein Schritt im Index-Refresh
   (`docs/research/0002-refresh-recommended-voices.md`).

4. **Eine Festlegung greift nur, wenn ihre Sprachfamilie zur aufgelösten
   Sprache passt UND die genannte Stimme tatsächlich installiert** ist auf dem
   Gerät des Besuchers. Eine Festlegung für eine Sprache, die der Besucher
   nicht hört, oder für eine fehlende Stimme wird ignoriert — der Besucher
   hört nie die falsche Sprache und bekommt nie ein stummes No-Op. Das ist die
   „graceful-degrade"-Option, die ADR 0008 ablehnte, jetzt sicher, weil der
   Name aus dem kuratierten Index stammt, nicht aus dem Gedächtnis des Admins.

5. **Eine Festlegung schlägt die automatische Wahl aus ADR 0008, aber nie den
   eigenen Override des Besuchers** und ändert nie, welche Sprache aufgelöst
   wird oder ob eine Stimme gefunden wurde. Ein neuer reiner Schritt
   `preferAdminPinnedVoice` läuft vor `preferRecommendedVoice` innerhalb von
   `pickVoiceForLang`; beide fallen auf die erste gesammelte Stimme der Sprache
   zurück (heutiges Verhalten), wenn nichts greift.

6. **Trägt ein Gerät mehrere Plattform-Tags** (ein iPad meldet iPadOS und
   macOS; Edge-auf-Windows meldet Windows und Edge), gewinnt die
   höchstpriore Festlegung, die auflöst. Browser-Tags (Edge, ChromeDesktop)
   rangieren über OS-Tags, weil browser-spezifische Stimmen die
   höherwertigen Namen sind, die ein Admin für diesen Browser festlegt;
   innerhalb von Apples Doppel-Tag schlägt iPadOS das macOS.

## Konsequenzen

- **ADR 0005 wird geändert, nicht umgekehrt.** Der Admin kann *immer noch*
  keinen Stimmennamen freihändig eingeben; Festlegen ist auf Namen
  beschränkt, die der kuratierte Index bereits führt, was die ursprüngliche
  Fragilität schließt (ein festgelegter Name existiert auf seiner Plattform
  per Konstruktion) und dem Admin endlich pro-Stimmen-Kontrolle gibt.
- **Die Ablehnung „keine pro-Plattform-Admin-Einstellungen" aus ADR 0008 wird
  umgekehrt.** Der Einwand der Einstellungs-Explosion wird als Kosten der
  Admin-Kontrolle akzeptiert; er ist begrenzt (acht Einstellungen), und die
  Auswahlen werden generiert, nicht per Hand gepflegt.
- **Keine Migration.** Alle acht Einstellungen sind neu und defaulten auf
  `auto`; bestehende Installationen ändern sich nicht (Invariant I3: ohne
  gesetzte Festlegung ist die Leiter byteweise identisch mit dem
  Vor-Feature-Verhalten). Das vermeidet die Migrations-Fehlerklasse, die
  PR #26 erzeugte.
- **Snapshot-Pflege wächst um einen Schritt.** Ein Index-Refresh erfordert
  nun auch das Neugenerieren der `settings.yml`-Auswahl (das Build-Skript).
  Die Refresh-Checkliste und der Header in settings.yml weisen darauf hin.
- **Besucher-Dropdown unverändert.** Die pro-Post-Stimmenauswahl listet
  weiterhin die eigenen Geräte-Stimmen des Besuchers, nach Sprache
  gruppiert; der Besucher wählt aus, was sein Browser tatsächlich hat, „wie
  vorher". Die Admin-Dropdowns konfigurieren den *automatischen Default* pro
  Plattform.
- **Android-Ehrlichkeit unverändert.** Chrome Android liefert eine
  ungefilterte Stimmenliste inklusive Stimmen, deren Packs nicht installiert
  sind; ein festgelegter Name kann eine Phantom-Stimme matchen, die nicht
  sprechen kann, genauso wie die automatische Wahl aus ADR 0008. Die
  Festlegung ist eine Verfeinerung, kein Android-Fix.

## Betrachtete Optionen

- **Ein Freitext `default_voice_name` pro Plattform.** Abgelehnt: führt die
  ADR-0005-Fragilität wieder ein (Tippfehler, ausgemusterte Namen) und
  verliert die Sprach-Scope-Wächter. Ein `enum` kuratierter Namen ist sowohl
  typisiert als auch sprach-präfixiert.
- **Pro-Sprache-und-Plattform-Einstellungen (`voice_de_macos`, …).**
  Abgelehnt: 7 Sprachen × 8 Plattformen = 56 Einstellungen. Der einzige
  Sprach-Familien-Matchwächter lässt eine Einstellung pro Plattform für alle
  abgedeckten Sprachen genügen.
- **Dynamische Auswahllisten, gegliedert nach `default_voice`.** Abgelehnt:
  Discourse-Theme-`enum`-Auswahlen sind statisch in `settings.yml`; es gibt
  keinen Mechanismus für abhängige Auswahlen. Das Sprach-Präfix im Wert ist
  der ehrliche Ersatz, und der Familien-Matchwächter setzt das Scoping zur
  Laufzeit durch.
- **Harte Festlegung (festgelegter Name oder kein-Stimme-Hinweis).** Aus
  demselben Grund wie in 0008 abgelehnt: ein fehlender festgelegter Name darf
  einen Beitrag mit anderen nutzbaren Stimmen der Sprache nicht stummlegen.
  Die Festlegung degradiert auf die automatische Wahl aus ADR 0008, dann auf
  jede Stimme der Sprache.