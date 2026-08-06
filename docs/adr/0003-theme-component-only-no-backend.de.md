# Nur Theme-Component: kein Backend, keine Abhängigkeiten, On-Device-TTS

Dieses Projekt ist eine Discourse-Theme-Component und sonst nichts. Es gibt
bewusst kein Server-Plugin, keine API-Schlüssel, keinen externen TTS-Dienst und
keine Audio-Datei-Generierung — die Sprache kommt von der Web Speech API des
Browsers auf dem Gerät des Besuchers. Die expliziten Nein schützen den
Kernwert: null Setup, null Kosten, null Privacy-Exposition. Roadmap-Ideen, die
einen Server brauchen (z. B. vorgenerierte MP3s mit einem Cloud-TTS), bleiben
bewusst außerhalb des Umfangs.