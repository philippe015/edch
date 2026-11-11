/** EDCH v1.6.5: standalone, offline HTML reports replacing BGS and Commandes-PRO PDF downloads.
 * Text is always escaped. No remote assets, scripts or active content.
 */
import type { BgsState } from "../bgs/core.js";
import { trendOf } from "../bgs/trends.js";
import type { ControlsPdfData } from "../controls/controlsPdf.js";

export const escapeHtml = (raw: unknown): string => String(raw ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const MAX_ROWS = 3_000;
const fmt = (value?: number): string => typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
const date = (value?: string): string => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("fr-FR") : "Non disponible";
const cell = (value: unknown) => `<td>${escapeHtml(value)}</td>`;
function report(title: string, subtitle: string, content: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'">
<title>${escapeHtml(title)}</title><style>
:root{color-scheme:light}body{font-family:Arial,Helvetica,sans-serif;color:#172536;background:#f2f5f9;margin:0;padding:28px}
main{max-width:1150px;margin:auto;background:white;padding:28px;border-radius:12px;box-shadow:0 4px 30px #14273c14}
h1{font-size:25px;margin:0 0 6px}h2{margin-top:28px;border-bottom:2px solid #e6edf4;padding-bottom:8px;font-size:19px}
.subtitle,.small{color:#5c6e80;font-size:13px}.metrics{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}
.metric{padding:12px 18px;border:1px solid #dbe4ee;border-radius:8px;min-width:150px}.metric strong{font-size:22px;display:block}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #e3eaf1;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2f7;position:sticky;top:0}
.note{padding:12px 14px;background:#f2f6fb;border-left:4px solid #637d9b;margin-top:18px}footer{border-top:1px solid #e4eaf1;padding-top:14px;margin-top:28px;color:#53677b;font-size:12px}
@media print{body{padding:0;background:#fff}main{box-shadow:none;padding:0}th{position:static}@page{size:A4 landscape;margin:12mm}}
</style></head><body><main><header><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(subtitle)}</div></header>
${content}
<footer>EDCH — Auteur original : CMDR MDLuffy · Contribution BGS / Manjaro / Commandes : Cyberpunk Philou.<br>Rapport local autonome HTML, non connecté à Internet. Aucun profil de jeu n'a été modifié par cet export.</footer></main></body></html>`;
}
function metric(label: string, value: string | number): string {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong>${escapeHtml(label)}</div>`;
}

export function buildBgsReportHtml(state: BgsState, commander = ""): string {
  if (!state || !Array.isArray(state.systems) || !Array.isArray(state.history)) throw new Error("invalid BGS snapshot");
  const systems = state.systems.slice(0, MAX_ROWS);
  const controls = systems.filter(s => s && s.controls === true).length;
  const now = Date.now();
  const stale = systems.filter(s => !s || !s.updatedAt || !Number.isFinite(Date.parse(s.updatedAt)) || now-Date.parse(s.updatedAt)>7*86400000).length;
  const rows = systems.map((system) => {
    if (!system || typeof system.name !== "string") return "";
    const trend = trendOf(state, system);
    return `<tr>${cell(system.name)}${cell(system.controls === true ? "Oui" : system.controls === false ? "Non" : "Inconnu")}`+
      `${cell(fmt(system.influence))}${cell(fmt(trend.delta))}${cell(system.source)}${cell(date(system.updatedAt))}`+
      `${cell(date(system.lastVisitedAt))}${cell((system.states || []).join(", "))}${cell((system.note || "").slice(0,500))}</tr>`;
  }).join("\n");
  const content = `<div class="metrics">${metric("Systèmes dans le relevé",state.systems.length)}${metric("Contrôlés (liste affichée)",controls)}${metric("Données de plus de 7 jours / inconnues (liste)",stale)}</div>
  <div class="note">Observations Spansh : indicatives, pas une preuve de tick Elite Dangerous. Les variations correspondent uniquement aux relevés disponibles. Le profil du CMDR reste local.</div>
  <h2>Faction et sources</h2><p><b>Faction suivie :</b> ${escapeHtml(state.faction)}<br><b>Commandant :</b> ${escapeHtml(commander || "Non indiqué")}<br><b>Dernière recherche :</b> ${escapeHtml(date(state.lastFetchedAt))}<br><b>Tick EDCD annoncé :</b> ${escapeHtml(date(state.tickAt))}${state.partial ? " · Recherche partielle" : ""}</p>
  <h2>Relevés par système</h2><div class="scroll"><table><thead><tr><th>Système</th><th>Contrôle</th><th>Influence %</th><th>Variation pts</th><th>Source</th><th>Date relevé</th><th>Visité</th><th>États</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${state.systems.length>MAX_ROWS ? `<p class="small">Rapport limité aux ${MAX_ROWS} premières lignes, sur ${state.systems.length} systèmes.</p>` : ""}`;
  return report("EDCH — Rapport BGS HTML",`Édité le ${new Date().toLocaleString("fr-FR")}`,content);
}

export function buildControlsReportHtml(data: ControlsPdfData): string {
  const devices=data.devices.slice(0,100).map(d=>`<tr>${cell(d.device)}${cell(d.assigned)}${cell(d.actions)}${cell(d.axes)}${cell(d.sharedInputs)}${cell(d.catalogued?"Référencé":"Non référencé")}</tr>`).join("\n");
  const overlaps=data.overlaps.slice(0,200).map(o=>`<tr>${cell(o.device)}${cell(o.key)}${cell(o.modifiers)}${cell(o.group)}${cell(o.actions.join(" / "))}</tr>`).join("\n");
  const essentials=data.essentials.slice(0,100).map(e=>`<tr>${cell(e.action)}${cell(e.bound?"Affectée":"Non affectée, à vérifier")}</tr>`).join("\n");
  const words=data.translations.toReview.slice(0,300).map(v=>`<li>${escapeHtml(v)}</li>`).join("\n");
  const content=`<div class="metrics">${metric("Périphériques référencés",data.devices.length)}${metric("Touches partagées à examiner",data.overlaps.length)}${metric("Actions explicitement traduites",data.translations.referenceFrench+" / "+data.translations.boundActions)}</div>
  <div class="note">Ce diagnostic lit uniquement les affectations enregistrées dans les profils .binds : il ne détecte pas si le HOTAS est branché. Une touche partagée n'est pas automatiquement une erreur.</div>
  <h2>Profil analysé</h2><p>${escapeHtml(data.preset.slice(0,180))}</p>
  <h2>Inventaire des périphériques</h2><div class="scroll"><table><thead><tr><th>Périphérique</th><th>Affectations</th><th>Actions</th><th>Axes</th><th>Touches partagées</th><th>Catalogue</th></tr></thead><tbody>${devices}</tbody></table></div>
  <h2>Touches partagées : vérification contextuelle</h2><div class="scroll"><table><thead><tr><th>Périphérique</th><th>Touche</th><th>Modificateurs</th><th>Groupe</th><th>Actions</th></tr></thead><tbody>${overlaps}</tbody></table></div>
  <h2>Commandes conseillées (référentiel uniquement)</h2><div class="scroll"><table><thead><tr><th>Action Elite</th><th>État</th></tr></thead><tbody>${essentials}</tbody></table></div>
  <h2>Libellés français à relire</h2><p class="small">L'absence de traduction spécifique n'implique pas une erreur.</p><ul>${words}</ul>`;
  return report("EDCH — Commandes PRO HTML",`Édité le ${new Date().toLocaleString("fr-FR")}`,content);
}
