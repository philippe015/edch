/** Pure helpers for the Cyberpunk Philou storage inventory (no filesystem effects). */
export interface MeteredLocation { bytes: number; incomplete: boolean }
export function readableBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Inconnu";
  if (value < 1024) return `${Math.round(value)} octets`;
  const units = ["Kio", "Mio", "Gio", "Tio"];
  let n = value;
  let index = -1;
  do { n /= 1024; index++; } while (n >= 1024 && index < units.length - 1);
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${units[index]}`;
}
/** Never present a partial disk scan as a complete total. */
export function storageTotal(entries: readonly MeteredLocation[]): number | null {
  if (entries.some(e => e.incomplete || !Number.isSafeInteger(e.bytes) || e.bytes < 0)) return null;
  return entries.reduce((sum, e) => sum + e.bytes, 0);
}
