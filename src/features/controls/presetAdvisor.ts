/** EDCH v1.6.6 — deterministic local assignment catalog and cautious profile suggestions.
 * All recommendations are advisory and require explicit preview/confirmation before saving.
 */
import { type Bind, type BindsMeta, groupOf } from "./binds.js";
import { approvedPreparedKey } from "./preparedKeys.js";

export type ControlTab = "all" | "ship" | "srv" | "foot" | "ui";
export type SuggestedProfile = "balanced" | "navigation" | "combat" | "exploration";
export interface PresetAssignment {
  action: string;
  slot: "primary" | "secondary";
  device: string;
  key: string;
  modifiers: { device: string; key: string }[];
  replaceExisting: boolean;
}
export interface AssignmentRow {
  action: string;
  group: string;
  primary?: Bind;
  secondary?: Bind;
}
export interface ProfileAdvice {
  kind: SuggestedProfile;
  name: string;
  description: string;
  covered: number;
  relevant: number;
  changes: PresetAssignment[];
  warnings: string[];
}

const PROFILES: Record<SuggestedProfile, { name: string; description: string; match: RegExp }> = {
  balanced: {
    name: "Équilibré", description: "Navigation, sécurité, commandes essentielles du vaisseau.",
    match: /(hyperspace|supercruise|hyperSuper|landingGear|cargoScoop|engineBoost|flightAssist|targetAhead|galaxyMap|systemMap|UIFocus|deployHardpoint|selectTarget)/i,
  },
  navigation: {
    name: "Navigation BGS", description: "Déplacements, carte galactique, systèmes et saut FSD.",
    match: /(hyper|supercruise|jump|galaxyMap|systemMap|mapOpen|targetAhead|landingGear|uiFocus|route)/i,
  },
  combat: {
    name: "Combat", description: "Tir, ciblage, armes et gestion d'énergie.",
    match: /(firePrimary|fireSecondary|deployHardpoint|target|pips|engineBoost|distribute|defence|defense|weapon|chaff|shieldCell)/i,
  },
  exploration: {
    name: "Exploration", description: "FSS, DSS, scanners et navigation.",
    match: /(FSS|DSS|scanner|discovery|explor|galaxyMap|systemMap|supercruise|hyperSuper|cargoScoop)/i,
  },
};
const TAB_GROUPS: Record<Exclude<ControlTab, "all">, Set<string>> = {
  ship: new Set(["Ship", "Fighter", "Scanners", "Multicrew"]),
  srv: new Set(["SRV"]),
  foot: new Set(["OnFoot", "Holo-Me"]),
  ui: new Set(["UI", "Galaxy map", "Camera", "Head look", "Misc"]),
};
/** High-confidence semantic hints, not Elite defaults. Only offer if the exact key is already seen
 * in this source file and remains free in the target context. Never assign unrelated keys. */
const PREFERRED: readonly [RegExp, readonly string[]][] = [
  [/^HyperSuperCombination$/i,["Key_J"]],
  [/^GalaxyMapOpen$/i,["Key_M"]],
  [/^SystemMapOpen$/i,["Key_N"]],
  [/^LandingGearToggle$/i,["Key_L"]],
  [/^ToggleCargoScoop$/i,["Key_H"]],
  [/^EngineBoost$/i,["Key_Tab"]],
  [/^FirePrimary$/i,["Mouse_1"]],
  [/^FireSecondary$/i,["Mouse_2"]],
];
const stripAccents = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
export const bindingKey = (b: Pick<Bind, "device" | "key" | "modifiers">): string => JSON.stringify([
  b.device, b.key, [...b.modifiers].map(m => [m.device, m.key]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
]);
export function groupTab(group: string): ControlTab {
  for (const mode of ["ship", "srv", "foot", "ui"] as const) if (TAB_GROUPS[mode].has(group)) return mode;
  return "ui";
}
export function catalogRows(actions: readonly string[], binds: readonly Bind[], meta: BindsMeta, tab: ControlTab = "all", search="", label: (action: string) => string = a => a): AssignmentRow[] {
  const by = new Map<string, AssignmentRow>();
  for (const a of actions) {
    if (!/^[A-Za-z0-9_]{1,100}$/.test(a)) continue;
    const group = groupOf(meta,a);
    if (tab !== "all" && groupTab(group) !== tab) continue;
    if (search && !stripAccents(`${a} ${meta.controls[a]?.n ?? ""} ${label(a)}`).includes(stripAccents(search.trim().slice(0,120)))) continue;
    by.set(a,{action:a,group});
  }
  for (const b of binds) {
    const row=by.get(b.action);
    if (!row) continue;
    if (b.slot === "primary" && !row.primary) row.primary=b;
    else if (b.slot === "secondary" && !row.secondary) row.secondary=b;
  }
  return [...by.values()].sort((a,b)=>a.group.localeCompare(b.group,"fr")||a.action.localeCompare(b.action,"fr"));
}
export function inputCatalog(binds: readonly Bind[]): Bind[] {
  const inputs = new Map<string, Bind>();
  for (const b of binds) {
    if (b.slot === "axis" || !b.device || !b.key || b.device === "{NoDevice}" || b.key.includes("Axis")) continue;
    inputs.set(bindingKey(b), b);
  }
  return [...inputs.values()].sort((a,b)=>a.device.localeCompare(b.device,"fr")||a.key.localeCompare(b.key,"fr"));
}
export function occupancyWarnings(
  original: readonly Bind[], proposed: readonly PresetAssignment[], meta: BindsMeta,
): string[] {
  const warnings:string[]=[];
  const staged = new Set<string>();
  for (const change of proposed) {
    const slot = `${change.action}|${change.slot}`;
    if (staged.has(slot)) { warnings.push(`Attribution répétée : ${slot}`); continue; }
    staged.add(slot);
    const old=original.find(b=>b.action===change.action && b.slot===change.slot);
    if (old && !change.replaceExisting) warnings.push(`Emplacement déjà attribué : ${change.action} (${change.slot}).`);
    const sig=bindingKey(change);
    const grp=groupOf(meta,change.action);
    const used = original.filter(b=>b.slot!=="axis" && groupOf(meta,b.action)===grp && b.action!==change.action && bindingKey(b)===sig);
    const proposedUsed = proposed.filter(x=>x!==change && x.action!==change.action && groupOf(meta,x.action)===grp && bindingKey(x)===sig);
    if (used.length || proposedUsed.length) warnings.push(`Touche partagée à examiner (${grp}) : ${change.device} ${change.key} → ${change.action}.`);
  }
  return [...new Set(warnings)];
}

/** Picks only inputs proven to exist in the source file, preferentially keyboard, never analog axes.
 * A key can be reused across DISJOINT game contexts, but never if already mapped in the target group.
 * If no safe candidate exists, the advice remains empty rather than inventing a HOTAS button.
 */
export function recommendProfile(
  kind: SuggestedProfile, actions: readonly string[], binds: readonly Bind[], meta: BindsMeta, limit=8,
): ProfileAdvice {
  const profile=PROFILES[kind];
  const candidates=catalogRows(actions,binds,meta).filter(r=>profile.match.test(r.action));
  const pool=inputCatalog(binds).filter(b=>b.device==="Keyboard" || b.device==="Mouse");
  const changes:PresetAssignment[]=[];
  for (const row of candidates) {
    if (changes.length>=Math.min(12,Math.max(0,limit))) break;
    // Keep any existing action assignment intact. Propose only completely missing actions.
    if (row.primary || row.secondary) continue;
    const suggestions=PREFERRED.find(([pattern])=>pattern.test(row.action))?.[1] ?? [];
    const free=pool.find(input=>{
      if (!suggestions.includes(input.key)) return false;
      const key=bindingKey(input);
      if (binds.some(b=>b.slot!=="axis" && groupOf(meta,b.action)===row.group && bindingKey(b)===key)) return false;
      return !changes.some(c=>groupOf(meta,c.action)===row.group && bindingKey(c)===key);
    });
    if (!free) continue;
    changes.push({action:row.action,slot:"primary",device:free.device,key:free.key,modifiers:free.modifiers.map(m=>({...m})),replaceExisting:false});
  }
  const covered = candidates.filter(r=>r.primary||r.secondary).length;
  return {
    kind,name:profile.name,description:profile.description,covered,relevant:candidates.length,changes,
    warnings:changes.length ? ["Suggestions indicatives : chaque touche doit être vérifiée avant validation."] :
      ["Aucune touche correspondant aux recommandations prudentes n’est disponible. Les commandes existantes sont conservées."],
  };
}
export function isStagedAssignmentValid(c: PresetAssignment, actions: readonly string[], binds: readonly Bind[]): boolean {
  if (!actions.includes(c.action) || !["primary","secondary"].includes(c.slot)) return false;
  // A reviewed prepared AZERTY key is allowed even if no original action used it.
  // HOTAS, Xbox and mouse inputs still have to exist in the source file.
  if (!approvedPreparedKey(c.device,c.key,c.modifiers) &&
      !inputCatalog(binds).some(b=>bindingKey(b)===bindingKey(c))) return false;
  const previous=binds.find(b=>b.action===c.action && b.slot===c.slot);
  return !previous || c.replaceExisting;
}
