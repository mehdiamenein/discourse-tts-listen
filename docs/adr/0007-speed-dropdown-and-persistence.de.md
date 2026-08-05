# Geschwindigkeits-Dropdown: 0,1–2,0 in 0,1-Schritten, gespeichert, am `default_rate` ausgerichtet

**Status:** Angenommen.

Das Geschwindigkeits-Dropdown bietet 0,1-Schritte von 0,1× bis 2,0× (20
Optionen) und ersetzt die bisher grobe 0,25-Schritt-Folge
(`0,75; 1; 1,25; 1,5; 2`). Die Einstellung `default_rate` wird auf denselben
Bereich ausgerichtet (`min: 0,1, max: 2,0`, auf 0,1-Schritte begrenzt, Standard
`1,0`), sodass der Administrator-Standard immer ein echter Wert im Dropdown ist.

Zwei Gründe für die Feinabstufung und den Bereich:

- Besuchertests zeigten, dass 0,8× für manche Leser angenehm ist; feinere
  Schritte als 0,25 lassen Leute die für sie passende Rate treffen. Die volle
  0,1-Untergrenze wird bewusst beibehalten — „Optionen, die niemand nutzt" sind
  lieber erwünscht als „Einschränkungen, die die eine Person frustrieren, die
  sie braucht".
- Der bisherige `default_rate`-Bereich (0,5–3,0) passte nicht zum Dropdown
  (begrenzt auf 2,0), sodass ein Administrator-Standard von z. B. 2,5 weder
  angezeigt noch erreicht werden konnte. Die Ausrichtung beider Enden auf
  0,1–2,0 hebt diesen Widerspruch auf.

Die gewählte Rate wird **pro Browser in `localStorage` gespeichert** mit
denselben Revert-Regeln wie der Stimmen-Override: „Default" löscht die
gespeicherte Rate und der Player fällt auf `default_rate` zurück. Ein
Geschwindigkeitswechsel während der Wiedergabe startet den aktuellen Block wie
bisher mit der neuen Rate neu.