# Sprach-Lebenszyklus: niemals Autoplay, ein aktiver Player, Satz-Chunking

Der Player folgt Lebenszyklus-Regeln, die ein künftiger Leser sonst
„vereinfachen" könnte: er spielt nie automatisch los; nur ein Beitrag spricht
gleichzeitig (eine globale aktiver-Player-Sperre stoppt den vorherigen Player);
die Sprache stoppt bei Navigation und wenn ein Beitrag neu gerendert oder
entfernt wird. Lange Blöcke werden in satz-begrenzte Chunks (max 250 Zeichen)
zerlegt, weil Chrome längere Äußerungen lautlos abschneidet, und ein
periodisches `resume()` hindert Chrome-Desktop daran, lange Wiedergabe lautlos
zu pausieren. Das sind bewusste Zuverlässigkeits-Entscheidungen, keine Bugs.