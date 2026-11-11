/** EDCH Commandes PRO v1.6.4 — native, offline A4 PDF summary in standard WinAnsi fonts.
 * Only printable descriptions. No XML, private file paths or executable content is embedded.
 */
import type { DeviceAudit, EssentialCheck, KeyOverlap, TranslationAudit } from "./controlsPro.js";
export interface ControlsPdfData {
  devices: readonly DeviceAudit[];
  overlaps: readonly KeyOverlap[];
  essentials: readonly EssentialCheck[];
  translations: TranslationAudit;
  preset: string;
}

const PAGE_H = 841.89;
const MAX_PAGES = 70;
/** Encode PDF text safely with octal escapes; unsupported Unicode becomes a visible '?' placeholder. */
function pdfText(text: string): string {
  const special: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94,
    0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x0152: 0x8c, 0x0153: 0x9c,
  };
  let output = "(";
  for (const char of text.replace(/[\r\n\t]/g, " ")) {
    const cp = char.codePointAt(0)!;
    const b = cp >= 32 && cp <= 126 || cp >= 160 && cp <= 255 ? cp : (special[cp] ?? 63);
    if (b === 40 || b === 41 || b === 92) output += "\\" + String.fromCharCode(b);
    else if (b <= 126) output += String.fromCharCode(b);
    else output += "\\" + b.toString(8).padStart(3, "0");
  }
  return output + ")";
}
function wrap(input: string, length=88): string[] {
  const words = input.replace(/\s+/g, " ").trim().split(" ");
  const rows: string[] = []; let line = "";
  for (let word of words) {
    while (word.length > length) { if (line) { rows.push(line); line=""; } rows.push(word.slice(0,length)); word=word.slice(length); }
    if (line && line.length + word.length + 1 > length) { rows.push(line); line=""; }
    line += (line ? " " : "") + word;
  }
  if (line) rows.push(line);
  return rows.length ? rows : ["-"];
}
/** Returns a fully valid PDF binary without relying on browser printing or external libraries. */
export function buildControlsPdf(data: ControlsPdfData): Uint8Array {
  const pages: string[][] = [[]]; let y = 790;
  const page = () => pages[pages.length-1];
  const newline = () => { if (y < 65 && pages.length < MAX_PAGES) { pages.push([]); y=790; } };
  const line = (text: string, size=9, bold=false): void => {
    for (const part of wrap(text, size >= 12 ? 64 : 96)) {
      newline();
      if (y < 65) return; // upper bound protects PDF output size
      page().push(`BT /${bold ? "F2":"F1"} ${size} Tf 40 ${y.toFixed(1)} Td ${pdfText(part)} Tj ET`);
      y -= size+5;
    }
  };
  const title = (text: string) => { y-=6; line(text,12,true); y-=4; };
  line("EDCH - Commandes PRO v1.6.4",18,true);
  line("Diagnostic local des affectations Elite Dangerous (lecture seule)",10);
  line(`Profil : ${data.preset.slice(0,130) || "non renseigné"}`,9);
  line("Ce rapport provient des fichiers .binds, pas d'une détection de matériel branché.",9);
  title("Périphériques et affectations");
  for (const row of data.devices.slice(0,100)) {
    line(`${row.device}: ${row.assigned} affectation(s), ${row.actions} action(s), ${row.axes} axe(s), ${row.sharedInputs} touche(s) partagée(s) à examiner.`,9);
    if (!row.catalogued) line("  Identifiant absent du catalogue de modèles (connexion matérielle non vérifiée).",8);
  }
  title("Touches partagées - vérification contextuelle");
  if (!data.overlaps.length) line("Aucune touche partagée signalée dans un même groupe.");
  for (const row of data.overlaps.slice(0,150)) {
    line(`${row.device}, ${row.key}, ${row.group}: ${row.actions.join(" / ")}`,8);
  }
  title("Commandes conseillées (référentiel connu uniquement)");
  for (const item of data.essentials.slice(0,50)) {
    line(`${item.bound ? "Affectée" : "Non affectée / à vérifier"} : ${item.action}`,9);
  }
  title("Libellés français (vérification manuelle)");
  line(`${data.translations.referenceFrench} / ${data.translations.boundActions} action(s) avec traduction explicite dans le référentiel.`,9);
  line("Les autres libellés peuvent bénéficier de la traduction générique ; non équivalent à une erreur.",8);
  for (const action of data.translations.toReview.slice(0,100)) line(`À revoir : ${action}`,8);
  y-=6;
  line("Auteur original EDCH : CMDR MDLuffy. Contribution BGS / Manjaro : Cyberpunk Philou.",8);
  line("Aucun fichier de commandes original n'a été modifié par ce rapport.",8);
  const objects: string[] = ["", "<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const kids: number[] = [];
  for (let i=0;i<pages.length;i++) {
    const commands = pages[i].join("\n")+"\n";
    const contentId=objects.length;
    objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
    const pageId=objects.length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    kids.push(pageId);
  }
  objects[2]=`<< /Type /Pages /Kids [${kids.map(n=>`${n} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let source = "%PDF-1.4\n%EDCH\n";
  const offsets=[0];
  for (let i=1;i<objects.length;i++) { offsets.push(source.length); source+=`${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref=source.length;
  source+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const o of offsets.slice(1)) source+=`${String(o).padStart(10,"0")} 00000 n \n`;
  source+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}
