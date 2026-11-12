// Kurzcodes für Programmpunkte, damit Merklisten-Links kurz bleiben.
// Jeder Programmpunkt bekommt einen 5-stelligen Code (Ziffern und Kleinbuchstaben),
// der aus seiner id berechnet wird. Er bleibt gleich, solange die id gleich bleibt,
// auch wenn sich das übrige Programm ändert. Begründung: docs/link_kodierung.md
// Das Prüfskript meldet einen Fehler, falls zwei ids denselben Code ergeben.

export const CODE_LEN = 5;
const SPACE = 36 ** CODE_LEN; // 60.466.176 mögliche Codes

// FNV-1a, 32 Bit
export function sessionCode(id) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(id)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % SPACE).toString(36).padStart(CODE_LEN, '0');
}
