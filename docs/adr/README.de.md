# Architektur-Entscheidungen (ADR) — Kurzübersicht

Dieser Ordner hält jede Architektur-Entscheidung als eigenständige Datei
(`.de.md` deutsch, `.md` englisch). Diese README ist die **kompakte
deutsche Kurzübersicht** mit Verweisen auf die vollständigen Dateien; die
ausführliche englische Einzel-Seite steht in [README.md](README.md).

> Konventionen: BCP 47 Sprach-Codes; `auto` = „keine Präferenz"; die
> **Leiter** (ADR 0006) löst auf: Benutzer-Override → `default_voice` →
> Plattformsprache → `navigator.languages` → Stopp + Keine-Stimme-Hinweis.

| ADR | Entscheidung (kurz) | Ändert | Datei (DE) |
|---|---|---|---|
| 0001 | Stimme folgt der Plattform-Sprache, nicht dem Browser | — | [0001.de.md](0001-voice-language-follows-platform-locale.de.md) |
| 0002 | Auswahl in einem reinen, unit-getesteten Modul | — | [0002.de.md](0002-voice-selection-as-pure-testable-module.de.md) |
| 0003 | Nur Theme-Component: kein Backend, On-Device-TTS | — | [0003.de.md](0003-theme-component-only-no-backend.de.md) |
| 0004 | Lebenszyklus: kein Autoplay, ein Player, Satz-Chunking | — | [0004.de.md](0004-speech-lifecycle-and-reliability-rules.de.md) |
| 0005 | Einstellungen sind Sprach-Codes (enum), nicht Namen | — | [0005.de.md](0005-voice-settings-are-language-codes.de.md) |
| 0006 | `fallback_voice` weg, Codes normalisieren, Hinweis statt lautlosem Wechsel | ändert 0001; ersetzt 0005s Zwei-Einstellungs-Modell | [0006.de.md](0006-voice-selection-redesign.de.md) |
| 0007 | Geschwindigkeits-Dropdown 0,1–2,0 in 0,1-Schritten, gespeichert | — | [0007.de.md](0007-speed-dropdown-and-persistence.de.md) |
| 0008 | Pro-Plattform empfohlene Stimme aus kuratiertem Index | ergänzt 0005 | [0008.de.md](0008-per-platform-recommended-voice.de.md) |
| 0009 | Admin pinnt pro Plattform einen Namen aus dem Index | ändert 0005 und 0008 | [0009.de.md](0009-admin-per-platform-voice-pin.de.md) |

## Einzeiler: was / warum / nutzen

- **0001** — Startsprache = Foren-Sprache (`document.documentElement.lang`).
  *Warum:* deutsch-zuerst-Community. *Nutzen:* nicht zur Browser-Locale
  „korrigieren".
- **0002** — `selectVoice` in `javascripts/discourse/lib/tts-selection.js`,
  QUnit in CI. *Nutzen:* Theme-Tests ohne `javascripts/`-Präfix addressieren.
- **0003** — Kein Server, keine API-Keys, nur Web Speech API. *Warum:* null Setup,
  null Kosten, null Privacy.
- **0004** — Kein Autoplay; ein aktiver Player (Sperre); Stopp bei
  Navigation/Re-Render; Chunks ≤ 250 Zeichen; `resume()` für Chrome-Desktop.
  *Nutzen:* nicht „vereinfachen".
- **0005** — `default_voice`/`fallback_voice` sind `enum`-Sprach-Codes;
  Migration `0001`. *Warum:* Stimmennamen scheitern stumm je Gerät.
- **0006** — `fallback_voice` entfernt (Migration `0002`); `lang`-Codes
  normalisiert; nie `list[0]`; Leiter endet im Keine-Stimme-Hinweis; Override als
  `{lang, name}` in `localStorage`. *Warum:* Android-Kunde bekam hi-IN in
  deutschem Forum. *Nutzen:* `show_no_voice_notice` (Standard `true`).
- **0007** — 20 Optionen 0,1×–2,0×; `default_rate` auf 0,1–2,0 ausgerichtet; Rate
  in `localStorage`, „Default" = Revert. *Warum:* 0,8× angenehm; alter Bereich
  0,5–3,0 passte nicht zum ≤2,0-Dropdown.
- **0008** — Komponente liefert vendorten Readium-Index
  (`de en fr es it pt nl`); reiner Schritt `preferRecommendedVoice` wählt die
  Stimme *innerhalb* der Sprache; Reihenfolge Region → `preloaded` → `quality` →
  `localService` → Index; Match case-insensitiv über `name`/`altNames`. *Warum:*
  `getVoices()`-Reihenfolge unspezifiziert → Zufall. *Nutzen:* keine
  Einstellung/Migration; Fallback „irgendeine Stimme der Sprache" (I1).
- **0009** — Acht neue `enum`-Einstellungen (`voice_macos`, `voice_ios`,
  `voice_ipados`, `voice_windows`, `voice_android`, `voice_chromeos`,
  `voice_chrome_desktop`, `voice_edge`), default `auto`; Werte `"<lang>: <name>"`
  aus dem Index, per `scripts/build-voice-choices.mjs` generiert; Pin greift nur
  bei Sprachfamilien-Match **und** installierter Stimme; schlägt 0008, nie den
  Besucher-Override; `preferAdminPinnedVoice` vor `preferRecommendedVoice`.
  *Warum:* 0008 zeigte dem Admin keine der kuratierten Namen. *Nutzen:* keine
  Migration; ohne Pin byteweise identisch (I3).

## Verwandte Recherche

- [`research/0001-android-voice-selection-bug.md`](../research/0001-android-voice-selection-bug.md) — der Android-Bug hinter ADR 0006.
- [`research/0002-per-platform-voice-names.md`](../research/0002-per-platform-voice-names.md) — kein Name spannt Plattformen; Basis von ADR 0008.
- [`research/0002-refresh-recommended-voices.md`](../research/0002-refresh-recommended-voices.md) — Index neu erzeugen (ADR 0008/0009).