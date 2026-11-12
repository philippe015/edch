/** EDCH v1.6.10 — scoped, offline advice for French keyboard, HOTAS and Xbox.
 * The native .binds writer accepts only device/key pairs already present in
 * the source preset. Never synthesize an X52/X56/Xbox button number.
 */
import { type Bind, type BindsMeta, deviceInfo, groupOf } from "./binds.js";
import { bindingKey, inputCatalog, type PresetAssignment } from "./presetAdvisor.js";

export type GameScope = "ship" | "srv" | "foot";
export type InputFamily = "azerty" | "hotas" | "xbox";
export type Usage = "balanced" | "navigation" | "combat" | "exploration";
export const GAME_SCOPES: readonly {id:GameScope; label:string; description:string}[] = [
  {id:"ship", label:"Vaisseau", description:"Pilotage, navigation, ciblage et combat spatial"},
  {id:"srv", label:"SRV / VRS", description:"Conduite, tourelle et exploration planétaire"},
  {id:"foot", label:"À pied", description:"Odyssey : mobilité, combat et exploration au sol"},
];
export const INPUT_FAMILIES: readonly {id:InputFamily; label:string}[] = [
  {id:"azerty", label:"Clavier AZERTY"},
  {id:"hotas", label:"HOTAS X52 Pro / X56"},
  {id:"xbox", label:"Manette Xbox"},
];
export const USAGE_STYLES: readonly {id:Usage;label:string}[] = [
  {id:"balanced",label:"Équilibré"},
  {id:"navigation",label:"Navigation / BGS"},
  {id:"combat",label:"Combat"},
  {id:"exploration",label:"Exploration"},
];

/* Each role is shared only when the game controls express an equivalent task.
 * The target must actually exist in the selected Odyssey .binds file.
 */
const ROLES: Record<string, Partial<Record<GameScope,string>>> = {
  fire: {ship:"PrimaryFire",srv:"BuggyPrimaryFireButton",foot:"HumanoidPrimaryFireButton"},
  secondaryFire: {ship:"SecondaryFire",srv:"BuggySecondaryFireButton"},
  target: {ship:"SelectTarget",srv:"SelectTarget_Buggy"},
  scoop: {ship:"ToggleCargoScoop",srv:"ToggleCargoScoop_Buggy"},
  galmap: {ship:"GalaxyMapOpen",srv:"GalaxyMapOpen_Buggy",foot:"GalaxyMapOpen_Humanoid"},
  sysmap: {ship:"SystemMapOpen",srv:"SystemMapOpen_Buggy",foot:"SystemMapOpen_Humanoid"},
  systems: {ship:"IncreaseSystemsPower",srv:"IncreaseSystemsPower_Buggy",foot:"HumanoidIncreaseSystemsPowerButton"},
  engines: {ship:"IncreaseEnginesPower",srv:"IncreaseEnginesPower_Buggy",foot:"HumanoidIncreaseEnginesPowerButton"},
  weapons: {ship:"IncreaseWeaponsPower",srv:"IncreaseWeaponsPower_Buggy",foot:"HumanoidIncreaseWeaponsPowerButton"},
  lights: {srv:"HeadlightsBuggyButton",foot:"HumanoidToggleFlashlightButton"},
  jump: {foot:"HumanoidJumpButton"},
  interact: {foot:"HumanoidPrimaryInteractButton"},
  reload: {foot:"HumanoidReloadButton"},
  scan: {foot:"HumanoidPulseScanButton"},
  vision: {foot:"HumanoidToggleNightVisionButton"},
  sprint: {foot:"HumanoidSprintButton"},
  crouch: {foot:"HumanoidCrouchButton"},
  fsd: {ship:"HyperSuperCombination"},
  boost: {ship:"UseBoostJuice"},
  landing: {ship:"LandingGearToggle"},
  brake: {srv:"AutoBreakBuggyButton"},
  turret: {srv:"ToggleBuggyTurretButton"},
};
const PLAN: Record<GameScope,Record<Usage,readonly string[]>> = {
  ship: {
    balanced:["fsd","boost","landing","target","fire","secondaryFire"],
    navigation:["fsd","landing","scoop","galmap","sysmap"],
    combat:["fire","secondaryFire","target","systems","weapons"],
    exploration:["fsd","scoop","galmap","sysmap","engines"],
  },
  srv: {
    balanced:["brake","fire","turret","target","lights"],
    navigation:["brake","target","lights","galmap","sysmap"],
    combat:["fire","secondaryFire","turret","target","weapons"],
    exploration:["lights","scoop","galmap","sysmap","brake"],
  },
  foot: {
    balanced:["interact","jump","sprint","crouch","reload","fire"],
    navigation:["jump","interact","scan","galmap","sysmap"],
    combat:["fire","reload","jump","crouch","systems"],
    exploration:["scan","vision","lights","interact","galmap"],
  },
};
const AZERTY: Partial<Record<string,string>> = {
  fsd:"Key_J",boost:"Key_Tab",landing:"Key_L",target:"Key_T",scoop:"Key_H",
  galmap:"Key_M",sysmap:"Key_N",lights:"Key_F",jump:"Key_Space",
  interact:"Key_E",reload:"Key_R",scan:"Key_V",vision:"Key_N",
  brake:"Key_Space",turret:"Key_T",sprint:"Key_LeftShift",crouch:"Key_LeftControl",
};

export function inputFamilyMatches(bind: Bind, family: InputFamily, meta:BindsMeta): boolean {
  if (family === "azerty") return bind.device === "Keyboard";
  const info = deviceInfo(meta, bind.device);
  if (family === "xbox") {
    return info.kind === "gamepad" || /^(?:Pad|GamePad|Xbox|XInput)/i.test(bind.device);
  }
  if (/^(?:Pad|GamePad|Xbox|XInput)/i.test(bind.device)) return false;
  // Unknown hexadecimal joystick IDs may be recognized as joystick by EDCH.
  return info.kind === "joystick" && !/^(?:Keyboard|Mouse)$/i.test(bind.device);
}
export function scopeForGroup(group:string):GameScope|null {
  if (["Ship","Fighter","Scanners","Multicrew"].includes(group)) return "ship";
  if(group === "SRV") return "srv";
  if(group === "OnFoot" || group === "Holo-Me") return "foot";
  return null;
}
export function detectedInputs(binds:readonly Bind[],family:InputFamily,meta:BindsMeta):Bind[] {
  return inputCatalog(binds).filter((b)=>inputFamilyMatches(b,family,meta));
}
export interface ScopedAdvice {
  scope:GameScope;
  family:InputFamily;
  usage:Usage;
  covered:number;
  relevant:number;
  absent:string[];
  changes:PresetAssignment[];
  warnings:string[];
}
export function recommendScopedProfile(
 scope:GameScope, family:InputFamily, usage:Usage,
 actions:readonly string[], binds:readonly Bind[], meta:BindsMeta,
):ScopedAdvice {
  const allActions=new Set(actions);
  const inputs=detectedInputs(binds,family,meta);
  const known=new Set(inputs.map(bindingKey));
  const result:PresetAssignment[]=[];
  const absent:string[]=[];
  let covered=0;
  let relevant=0;
  for (const role of PLAN[scope][usage]) {
    const target=ROLES[role]?.[scope];
    if (!target || !allActions.has(target)) {
      if(target) absent.push(target);
      continue;
    }
    if (scopeForGroup(groupOf(meta,target))!==scope) continue;
    relevant++;
    if (binds.some(b=>b.action===target && b.slot!=="axis" && inputFamilyMatches(b,family,meta))) {
      covered++;
      continue;
    }
    const available=binds.filter(b=>b.action===target&&b.slot!=="axis");
    const slot: "primary"|"secondary"|null =
      !available.some(b=>b.slot==="primary") ? "primary" :
      !available.some(b=>b.slot==="secondary") ? "secondary" : null;
    if(!slot) continue; // never replace existing mouse, keyboard or HOTAS assignments
    const peerActions=Object.values(ROLES[role] ?? {}).filter((a):a is string=>typeof a==="string"&&a!==target);
    // AZERTY uses a known printed French key, while controller layouts are inferred
    // exclusively from an already assigned equivalent action in a different game mode.
    const choices=family==="azerty"
      ? inputs.filter(b=>b.key===AZERTY[role]&&!b.modifiers.length)
      : inputs.filter(b=>peerActions.includes(b.action)&&!b.modifiers.length);
    const candidate=choices.find(b=>{
      const sig=bindingKey(b);
      if(!known.has(sig)) return false;
      // One input must not be assigned to multiple actions in the SAME game context.
      if(binds.some(other=>other.slot!=="axis"&&other.action!==target&&
        scopeForGroup(groupOf(meta,other.action))===scope&&bindingKey(other)===sig)) return false;
      if(result.some(other=>bindingKey(other)===sig)) return false;
      return true;
    });
    if(!candidate) continue;
    result.push({
      action:target,slot,device:candidate.device,key:candidate.key,
      modifiers:candidate.modifiers.map(m=>({...m})),replaceExisting:false,
    });
  }
  const warnings:string[]=[];
  if(family!=="azerty") warnings.push("Aucun numéro HOTAS/Xbox n'est deviné : seuls les boutons déjà vérifiables dans le profil du jeu peuvent être proposés.");
  if(!inputs.length) warnings.push("Aucun bouton de ce périphérique trouvé dans le préréglage sélectionné. Vérifier les fichiers .binds et la connexion dans le jeu.");
  if(!result.length) warnings.push("Aucune attribution sûre à ajouter. Les touches existantes sont conservées ; l'attribution manuelle reste possible.");
  return {scope,family,usage,covered,relevant,absent,changes:result,warnings};
}

/** Warn for collisions between different subgroups of the SAME playable context.
 * Unlike same-group reports, Ship+Scanners/Fighter are treated together.
 */
export function scopedInputWarnings(
  original:readonly Bind[], proposed:readonly PresetAssignment[], meta:BindsMeta,
):string[] {
  const replaced=new Set(proposed.map(p=>`${p.action}|${p.slot}`));
  const warnings:string[]=[];
  for(const p of proposed) {
    const scope=scopeForGroup(groupOf(meta,p.action));
    if(!scope) continue;
    const sig=bindingKey(p);
    const occupied=original.some(other=>
      other.slot!=="axis" && other.action!==p.action &&
      scopeForGroup(groupOf(meta,other.action))===scope &&
      !replaced.has(`${other.action}|${other.slot}`) && bindingKey(other)===sig);
    const staged=proposed.some(other=>
      other!==p && other.action!==p.action &&
      scopeForGroup(groupOf(meta,other.action))===scope &&
      bindingKey(other)===sig);
    if(occupied||staged) warnings.push(
      `Touche partagée dans ${scope}: ${p.device} ${p.key} pour ${p.action}. Vérifier avant de créer un profil.`);
  }
  return [...new Set(warnings)];
}
