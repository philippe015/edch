// EDCH-BGS-RELIABILITY-v1.4.9 — offline verification, never changes the BGS state.
import type { BgsState } from "./core.js";
import { buildBgsReportPdf } from "./reportPdf.js";

const MAX_BACKUP_BYTES = 8_000_000;
const MAX_PDF_BYTES = 8_000_000;

export function verifyBgsSnapshot(state: BgsState): { bytes: number; systems: number; history: number; json: string } {
  if (!state || typeof state.faction !== "string" || !state.faction.trim())
    throw new Error("Faction BGS non renseignée");
  if (!Array.isArray(state.systems) || !Array.isArray(state.history))
    throw new Error("Structure des systèmes ou de l'historique incorrecte");
  if (state.systems.length > 5000 || state.history.length > 10000)
    throw new Error("Sauvegarde trop volumineuse : limite de 5 000 systèmes et 10 000 relevés");
  const json = JSON.stringify(state, null, 2);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > MAX_BACKUP_BYTES) throw new Error("Sauvegarde BGS de plus de 8 Mo");
  if (!json || JSON.parse(json).faction !== state.faction) throw new Error("Sérialisation BGS invalide");
  return { bytes, systems: state.systems.length, history: state.history.length, json };
}

export function verifyBgsPdf(bytes: Uint8Array): { pages: number; bytes: number } {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 || bytes.length > MAX_PDF_BYTES)
    throw new Error("PDF vide, invalide ou trop volumineux");
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith("%PDF-") || !/%%EOF\s*$/.test(text)) throw new Error("En-tête ou fin de document PDF manquant");
  const pages = [...text.matchAll(/\/Type\s+\/Page\b/g)].length;
  if (pages < 1) throw new Error("Le PDF ne contient aucune page");
  return { pages, bytes: bytes.length };
}

export function diagnoseBgsReliability(state: BgsState, commander?: string) {
  const backup = verifyBgsSnapshot(state);
  const pdf = verifyBgsPdf(buildBgsReportPdf(state, { commander }));
  return {
    backup,
    pdf,
    message: `Contrôle OK : ${backup.systems} systèmes, ${backup.history} relevés ; sauvegarde JSON ${backup.bytes} octets ; PDF ${pdf.pages} page(s), ${pdf.bytes} octets. Aucune donnée modifiée.`,
  };
}
