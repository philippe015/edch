// EDCH-BGS-PDF-v1.4.3
// EDCH BGS v1.4.3 - True multi-page PDF export, generated offline without third-party libraries.
// Static PDF/WinAnsi fonts: no HTML, script, network request or external assets are embedded.
import type { BgsState, BgsSystem } from "./core.js";
import { trendAlerts, trendOf, trendsSummary } from "./trends.js";

const W = 595.28; // A4 points
const H = 841.89;
const LEFT = 39;
const RIGHT = 555;
const TOP = 798;
const BOTTOM = 55;
const MAX_ROWS = 5_000;

/** Encode Latin-1 and Windows-1252 punctuation for the standard PDF WinAnsiEncoding. */
function winAnsi(value: string): number[] {
  const replacements: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };
  const out: number[] = [];
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) {
      out.push(32);
      continue;
    }
    if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255)) out.push(cp);
    else if (replacements[cp]) out.push(replacements[cp]);
    else if (cp === 0x2192) out.push(45, 62);
    else if (cp === 0x2264) out.push(60, 61);
    else if (cp === 0x2265) out.push(62, 61);
    else out.push(63); // explicit fallback for characters not representable in standard fonts
  }
  return out;
}
function pdfLiteral(value: string): string {
  let out = "(";
  for (const byte of winAnsi(value)) {
    if (byte === 40 || byte === 41 || byte === 92) out += "\\" + String.fromCharCode(byte);
    else if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
    else out += "\\" + byte.toString(8).padStart(3, "0");
  }
  return out + ")";
}
function asciiBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
const fmt = (value: unknown): string => (typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "?");
const shortDate = (value?: string): string => (value && Number.isFinite(Date.parse(value)) ? value.slice(0, 10) : "?");
const valueOr = (value?: string): string => value?.trim() || "Non renseigné";

/** A Unicode-aware word-wrap approximation at conservative width for Helvetica. */
function wrap(value: string, maxChars: number): string[] {
  const input = value.replace(/\s+/g, " ").trim();
  if (!input) return ["-"];
  const lines: string[] = [];
  let line = "";
  for (const word of input.split(" ")) {
    if (line && line.length + word.length + 1 > maxChars) {
      lines.push(line);
      line = "";
    }
    if (word.length <= maxChars) {
      line += (line ? " " : "") + word;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    let remaining = word;
    while (remaining.length > maxChars) {
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars);
    }
    line = remaining;
  }
  if (line) lines.push(line);
  return lines;
}

/** Conservative Helvetica width estimation, for avoiding collision with the next column. */
function widthOf(value: string, size: number): number {
  let units = 0;
  for (const c of value) {
    if (c === " ") units += 0.278;
    else if ("MW".includes(c)) units += 0.945;
    else if ("mw".includes(c)) units += 0.84;
    else if ("ilIfjt".includes(c)) units += 0.3;
    else if ("r.,:;!'`".includes(c)) units += 0.34;
    else if (c >= "0" && c <= "9") units += 0.56;
    else if (c >= "A" && c <= "Z") units += 0.71;
    else units += 0.59;
  }
  return units * size;
}
function wrapWidth(text: string, availablePoints: number, size: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const joined = current ? `${current} ${word}` : word;
    if (widthOf(joined, size) <= availablePoints) {
      current = joined;
      continue;
    }
    if (current) chunks.push(current);
    current = "";
    for (const letter of word) {
      if (current && widthOf(current + letter, size) > availablePoints) {
        chunks.push(current);
        current = "";
      }
      current += letter;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : ["-"];
}

interface TextOp {
  x: number;
  y: number;
  size: number;
  bold: boolean;
  value: string;
}
interface LineOp {
  y: number;
}
type Operation = TextOp | LineOp;

class Layout {
  pages: Operation[][] = [[]];
  y = TOP;
  private page(): Operation[] {
    return this.pages[this.pages.length - 1];
  }
  ensure(height: number) {
    if (this.y - height < BOTTOM) {
      this.pages.push([]);
      this.y = TOP;
    }
  }
  space(size = 8) {
    this.ensure(size);
    this.y -= size;
  }
  text(value: string, size = 9.3, bold = false, indent = 0, height = 13) {
    this.ensure(height);
    this.page().push({ x: LEFT + indent, y: this.y, size, bold, value });
    this.y -= height;
  }
  paragraph(value: string, size = 9.3, width = 105, indent = 0) {
    for (const l of wrap(value, width)) this.text(l, size, false, indent, 12);
  }
  section(title: string) {
    this.ensure(35);
    this.y -= 11;
    this.text(title, 12.5, true, 0, 19);
    this.page().push({ y: this.y + 6 });
    this.y -= 4;
  }
  tableHeader() {
    this.ensure(30);
    const y = this.y;
    const labels: [string, number][] = [
      ["Système", 0],
      ["Inf. %", 174],
      ["Var. pts", 228],
      ["Contrôle", 296],
      ["Visité", 364],
      ["Relevé", 433],
    ];
    for (const [label, x] of labels) this.page().push({ x: LEFT + x, y, size: 8.2, bold: true, value: label });
    this.y -= 16;
    this.page().push({ y: this.y + 6 });
  }
  systemRow(s: BgsSystem, index: number, delta?: number) {
    // Long names are wrapped, never silently shortened. Details are printed on following lines.
    const names = wrapWidth(s.name, 164, 8.5);
    const notes = [
      `Source: ${s.source || "?"}  États: ${(s.states ?? []).join(", ") || "-"}`,
      s.distance !== undefined ? `Distance: ${fmt(s.distance)} AL` : "",
      s.note ? `Note: ${s.note}` : "",
    ]
      .filter(Boolean)
      .join("  |  ");
    const detailLines = wrapWidth(notes, 470, 7.6);
    const rowHeight = Math.max(names.length, 1) * 11 + detailLines.length * 10 + 8;
    this.ensure(Math.min(rowHeight, TOP - BOTTOM));
    // Reprint column headings on each new sheet at the first row if requested by caller.
    const y = this.y;
    const color = index % 2 === 0 ? "" : "";
    void color;
    for (let n = 0; n < names.length; n++)
      this.page().push({ x: LEFT, y: y - 11 * n, size: 8.5, bold: false, value: names[n] });
    const cells: [string, number][] = [
      [fmt(s.influence), 174],
      [fmt(delta), 228],
      [s.controls === true ? "Oui" : s.controls === false ? "Non" : "?", 296],
      [shortDate(s.lastVisitedAt), 364],
      [shortDate(s.updatedAt ?? s.retrievedAt), 433],
    ];
    for (const [value, x] of cells) this.page().push({ x: LEFT + x, y, size: 8.2, bold: false, value });
    this.y = y - names.length * 11 - 3;
    for (const l of detailLines) this.text(l, 7.6, false, 6, 10);
    this.y -= 5;
  }
}

function streamForPage(ops: Operation[], pageNum: number, total: number, faction: string): string {
  const out: string[] = ["q", "0.14 0.19 0.28 rg", "0.14 0.19 0.28 RG"];
  const text = (op: TextOp) =>
    out.push(
      `BT /${op.bold ? "F2" : "F1"} ${op.size} Tf 1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm ${pdfLiteral(op.value)} Tj ET`,
    );
  text({ x: LEFT, y: 821, size: 8.2, bold: true, value: "EDCH · BGS · RAPPORT PDF" });
  text({
    x: LEFT,
    y: 28,
    size: 8,
    bold: false,
    value: `Faction : ${faction.slice(0, 68)}  |  Page ${pageNum} / ${total}`,
  });
  for (const op of ops) {
    if ("value" in op) text(op);
    else out.push(`0.55 w ${LEFT} ${op.y.toFixed(2)} m ${RIGHT} ${op.y.toFixed(2)} l S`);
  }
  out.push("Q");
  return out.join("\n") + "\n";
}

/** Valid PDF v1.4, A4, page numbers, complete system list; no external renderer needed. */
export function buildBgsReportPdf(
  state: BgsState,
  options: { commander?: string; generatedAt?: Date } = {},
): Uint8Array {
  if (!state || !Array.isArray(state.systems) || !Array.isArray(state.history))
    throw new Error("Données BGS invalides.");
  if (state.systems.length > MAX_ROWS) throw new Error("Trop de systèmes pour un seul PDF (maximum 5000).");
  const faction = valueOr(state.faction);
  const layout = new Layout();
  const now = options.generatedAt ?? new Date();
  const observations = trendsSummary(state);
  const alerts = trendAlerts(state);
  const controlled = state.systems.filter((s) => s.controls === true).length;
  const present = state.systems.filter((s) => s.controls === false).length;
  const unknown = state.systems.length - controlled - present;
  layout.text("RAPPORT BGS - SUIVI ET PATROUILLES", 16, true, 0, 24);
  layout.text(`Faction : ${faction}`, 11, true, 0, 19);
  layout.text(`CMDR : ${valueOr(options.commander)}`, 9.5);
  layout.text(`Généré le : ${now.toLocaleString("fr-FR")}`, 9.3);
  layout.text(`Dernière recherche : ${shortDate(state.lastFetchedAt)}  |  Tick EDCD : ${shortDate(state.tickAt)}`, 9.3);
  layout.paragraph(
    `Couverture Spansh : ${state.partial ? "PARTIELLE, résultats manquants possibles" : "selon les relevés disponibles"}. ` +
      `Systèmes annoncés : ${state.reportedTotal ?? "inconnu"}.`,
  );
  layout.section("Synthèse");
  layout.text(
    `Systèmes : ${state.systems.length}  |  Contrôlés : ${controlled}  |  Présence : ${present}  |  Non vérifiés : ${unknown}`,
  );
  layout.text(
    `Influence en hausse : ${observations.rising}  |  Baisse : ${observations.falling}  |  Stable : ${observations.stable}  |  Sans comparaison : ${observations.unavailable}`,
  );
  layout.text(`Observations enregistrées : ${state.history.length}  |  Alertes : ${alerts.length}`);
  layout.section(`Alertes (${alerts.length})`);
  if (alerts.length === 0) layout.text("Aucune alerte récente identifiée.");
  else for (const alert of alerts.slice(0, 500)) layout.paragraph(`${alert.system}: ${alert.text}`, 9, 98);
  if (alerts.length > 500)
    layout.text(`${alerts.length - 500} alerte(s) supplémentaires non détaillées (limite de sécurité).`);
  layout.section("Source et limites");
  layout.paragraph(
    "Les valeurs proviennent des journaux et relevés disponibles. Un relevé Spansh peut être incomplet ou ancien. " +
      "Les variations comparent deux observations ; elles ne prouvent ni un tick exact, ni l'influence produite par un CMDR.",
    8.5,
    95,
  );
  layout.section(`Systèmes de la faction (${state.systems.length})`);
  layout.tableHeader();
  for (let i = 0; i < state.systems.length; i++) {
    const s = state.systems[i];
    if (layout.y < 106) {
      layout.pages.push([]);
      layout.y = TOP;
      layout.tableHeader();
    }
    const t = trendOf(state, s);
    layout.systemRow(s, i, t.delta);
  }
  if (!state.systems.length) layout.text("Aucun système enregistré. Actualisez la faction depuis Spansh.");
  // Objects use ASCII content streams; WinAnsi text is escaped as PDF octal bytes.
  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = ""; // page tree built after page objects
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const refs: string[] = [];
  for (let i = 0; i < layout.pages.length; i++) {
    const pageId = objects.length + 1;
    const streamId = pageId + 1;
    refs.push(`${pageId} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    const stream = streamForPage(layout.pages[i], i + 1, layout.pages.length, faction);
    objects.push(`<< /Length ${asciiBytes(stream).length} >>\nstream\n${stream}endstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${refs.join(" ")}] /Count ${layout.pages.length} >>`;
  let pdf = "%PDF-1.4\n%EDCH\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(asciiBytes(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = asciiBytes(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = asciiBytes(pdf);
  if (bytes.length > 8_000_000) throw new Error("Rapport PDF trop volumineux (> 8 Mo).");
  return bytes;
}
