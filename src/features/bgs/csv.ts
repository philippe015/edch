/** EDCH-BGS-v1.3 — safe spreadsheet exports, including untrusted user notes. */
export function quoteCsv(value: unknown): string {
  let text = String(value ?? "");
  const trimmed = text.trimStart();
  // Excel/LibreOffice may interpret cells starting with =, +, -, @ as formulas.
  // Keep valid signed numeric measurements usable as numbers.
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed);
  if (!numeric && /^[=+\-@]/.test(trimmed)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
