/** EDCH v1.6.8 — planning of physical X52 Pro modes, distinct from Elite game presets.
 * Nothing here promises that rotating the hardware selector switches Elite bindings.
 * Uses existing action IDs and actual source bindings; never fabricates controller IDs.
 */
import type { Bind, BindsMeta } from "./binds.js";
import { recommendProfile, type SuggestedProfile } from "./presetAdvisor.js";

export type X52ModeId = 1 | 2 | 3;
export interface X52ModeTemplate {
  id: X52ModeId;
  title: string;
  purpose: string;
  suggestedProfile: SuggestedProfile;
  targetActions: readonly { match: RegExp; label: string }[];
}
export interface ModeActionRow {
  action: string;
  label: string;
  current: string[];
  group: string;
}
export interface ModePlan {
  id: X52ModeId;
  title: string;
  purpose: string;
  suggestedProfile: SuggestedProfile;
  rows: ModeActionRow[];
  assigned: number;
  suggested: number;
}

/** Action names are matched against the source profile (not invented as game bindings). */
export const MODE_TEMPLATES: readonly X52ModeTemplate[] = [
  { id: 1, title: "Pilotage / Navigation", purpose: "Déplacement, saut FSD, aides au vol, panneaux et atterrissage.", suggestedProfile: "navigation", targetActions: [
    { match: /^(HyperSuperCombination|Hyperspace|Supercruise|SupercruiseToggle)$/i, label: "Saut FSD / Supercroisière" },
    { match: /^(EngineBoost|ToggleFlightAssist|FlightAssistOffButton)$/i, label: "Boost / Assistance de vol" },
    { match: /^(LandingGearToggle|LandingGearUp|LandingGearDown)$/i, label: "Train d'atterrissage" },
    { match: /^(GalaxyMapOpen|SystemMapOpen|GalaxyMapOpenToggle)$/i, label: "Carte galactique / Carte du système" },
    { match: /^(TargetAhead|SelectTarget|CycleNextTarget|CyclePreviousTarget)$/i, label: "Ciblage de navigation" },
    { match: /^(UIFocus|UIUp|UIDown|UILeft|UIRight|UISelect)$/i, label: "Panneaux et interface" },
    { match: /^(ToggleCargoScoop|CargoScoopToggle|LightsOnOffToggle)$/i, label: "Soute / Éclairage" },
  ] },
  { id: 2, title: "Combat", purpose: "Tir, armes, ciblage des menaces et défenses du vaisseau.", suggestedProfile: "combat", targetActions: [
    { match: /^(FirePrimary|FireSecondary)$/i, label: "Tir principal et secondaire" },
    { match: /^(DeployHardpoint|DeployHardpointsToggle|HardpointsToggle)$/i, label: "Déploiement des points d'emport" },
    { match: /^(SelectTarget|TargetAhead|CycleNextTarget|CyclePreviousTarget|SelectHighestThreat)$/i, label: "Sélection des cibles" },
    { match: /^(EngineBoost|ToggleFlightAssist)$/i, label: "Boost / Pilotage d'évasion" },
    { match: /^(UseChaffLauncher|UseShieldCell|UseHeatSink|DeployChaff|DeployHeatSink)$/i, label: "Contre-mesures / Cellules de bouclier" },
    { match: /^(IncreaseEnginesPower|IncreaseWeaponsPower|IncreaseSystemsPower|ResetPowerDistribution)$/i, label: "Gestion d'énergie" },
  ] },
  { id: 3, title: "Exploration / Patrouilles BGS", purpose: "FSS, scanners, cartes, trajets et relevés de systèmes.", suggestedProfile: "exploration", targetActions: [
    { match: /^(ExplorationFSSDiscoveryScan|ExplorationFSSMode|ExplorationFSSEnter|FSS.*|DSS.*)$/i, label: "FSS / DSS" },
    { match: /^(DiscoveryScan|DiscoveryScanner|BasicDiscoveryScan|AdvancedDiscoveryScan)$/i, label: "Scanner de découverte" },
    { match: /^(GalaxyMapOpen|SystemMapOpen|GalaxyMapOpenToggle)$/i, label: "Cartes et itinéraire" },
    { match: /^(HyperSuperCombination|Hyperspace|Supercruise|SupercruiseToggle)$/i, label: "Trajets / Saut FSD" },
    { match: /^(LandingGearToggle|ToggleCargoScoop)$/i, label: "Atterrissage / Soute" },
    { match: /^(UIFocus|UISelect|UIUp|UIDown|UILeft|UIRight)$/i, label: "Interface et panneaux" },
  ] },
];

const escapedHtml = (s: string): string => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const keyText = (b: Bind): string => `${b.device} : ${b.key}${b.modifiers.length ? " + " + b.modifiers.map(m=>`${m.device}:${m.key}`).join(" + ") : ""}`;

/** Returns *all* relevant known commands, never a hand-waved number of controls. */
export function buildX52ModePlans(actions: readonly string[], binds: readonly Bind[], meta: BindsMeta): ModePlan[] {
  const allowed = new Set(actions);
  return MODE_TEMPLATES.map(mode => {
    const labels = new Map<string,string>();
    for (const spec of mode.targetActions) {
      for (const action of actions) if (spec.match.test(action) && !labels.has(action)) labels.set(action,spec.label);
    }
    const rows = [...labels].sort((a,b)=>a[0].localeCompare(b[0],"fr")).map(([action,label]) => ({
      action, label,
      current: binds.filter(b=>b.action===action).map(b=>`${b.slot === "axis" ? "Axe" : b.slot === "primary" ? "P" : "S"} : ${keyText(b)}`),
      group: meta.controls[action]?.g ?? "Autre",
    })).filter(row=>allowed.has(row.action));
    const advice = recommendProfile(mode.suggestedProfile,actions,binds,meta);
    return { id:mode.id,title:mode.title,purpose:mode.purpose,suggestedProfile:mode.suggestedProfile,
      rows, assigned:rows.filter(row=>row.current.length>0).length, suggested:advice.changes.length };
  });
}

/** Raw Linux joystick index != game Joy_N by default. Candidates remain unconfirmed. */
export function x52ModeDialCandidates(rawIndex: number, binds: readonly Bind[]): string[] {
  if(!Number.isInteger(rawIndex)||rawIndex<0||rawIndex>255)return [];
  const deviceIds=new Set(binds.filter(b=>/saitek|x52|logitech/i.test(b.device)).map(b=>b.device));
  const known=new Set(binds.filter(b=>deviceIds.has(b.device)).flatMap(b=>[
    b.key,...b.modifiers.filter(m=>deviceIds.has(m.device)).map(m=>m.key)]));
  return [rawIndex,rawIndex+1].map(n=>`Joy_${n}`).filter((s,i,a)=>a.indexOf(s)===i && known.has(s));
}

/** Portable, self-contained HTML; reports remain offline and text escaped. */
export function renderX52ModesHtml(plans: readonly ModePlan[], sourceName: string, dial?: Readonly<Partial<Record<X52ModeId,number>>>): string {
  const sections = plans.map(plan => `<section><h2>Mode ${plan.id} — ${escapedHtml(plan.title)}</h2>
<p>${escapedHtml(plan.purpose)}</p><p><b>${plan.assigned}/${plan.rows.length}</b> commandes pertinentes déjà attribuées · ${plan.suggested} suggestion(s) prudente(s).</p>
<p>Sélecteur Linux : ${dial?.[plan.id]===undefined?"Non vérifié":`Index joydev ${Number(dial[plan.id])} (correspondance Elite non vérifiée)`}</p>
<table><thead><tr><th>Fonction</th><th>Identifiant Elite</th><th>Attribution du profil</th></tr></thead><tbody>${plan.rows.map(row=>
 `<tr><td>${escapedHtml(row.label)}</td><td><code>${escapedHtml(row.action)}</code></td><td>${row.current.length?row.current.map(x=>escapedHtml(x)).join(" ; "):"À configurer"}</td></tr>`).join("")}</tbody></table></section>`).join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>EDCH — Modes X52 Pro</title><style>body{font:15px system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 22px;color:#e8edf4;background:#121821}h1{color:#ffab40}h2{color:#ffb650}section{border:1px solid #465261;padding:20px;margin:24px 0;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #3a4653;text-align:left;padding:9px;vertical-align:top}small,.note{color:#afbdcd}code{overflow-wrap:anywhere}@media print{body{background:white;color:#111}section{break-inside:avoid}h1,h2{color:#222}th,td{border-color:#bbb}}</style></head><body><h1>EDCH — Configuration X52 Pro : modes 1, 2 et 3</h1><p>Profil de référence : <b>${escapedHtml(sourceName)}</b></p><p class="note">Ce document est un plan, pas un fichier .binds. La molette du X52 Pro ne change pas automatiquement les profils d'Elite Dangerous sans un mécanisme de modes compatible et vérifié. Les réglages d'axes existants restent inchangés.</p>${sections}<footer><small>EDCH original : CMDR MDLuffy · Extension BGS/HOTAS : Cyberpunk Philou · Rapport HTML hors ligne, sans scripts externes.</small></footer></body></html>`;
}
