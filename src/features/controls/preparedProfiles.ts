/** Cyberpunk Philou 1.6.12: prepared, *optional* AZERTY controls for Elite Dangerous.
 * Keys are user-defined suggestions, NOT claimed to be Frontier's default bindings.
 * Only known Odyssey action IDs may be edited; the original .binds is never touched.
 */
import { type Bind, type BindsMeta, groupOf } from "./binds.js";
import { type PresetAssignment } from "./presetAdvisor.js";
import { approvedPreparedKey } from "./preparedKeys.js";
import { scopeForGroup, type GameScope, type Usage } from "./scopedProfiles.js";

export interface KeyRule { action:string; key:string }
export interface PreparedTemplate {
  scope:GameScope;
  usage:Usage;
  label:string;
  description:string;
  rules:readonly KeyRule[];
}
export interface PreparedSkip { action:string; key:string; reason:string }
export interface PreparedPlan {
  template:PreparedTemplate;
  changes:PresetAssignment[];
  covered:number;
  available:number;
  skipped:PreparedSkip[];
  warnings:string[];
}

const moveFoot:readonly KeyRule[] = [
  {action:"HumanoidForwardButton",key:"Key_Z"},
  {action:"HumanoidBackwardButton",key:"Key_S"},
  {action:"HumanoidStrafeLeftButton",key:"Key_Q"},
  {action:"HumanoidStrafeRightButton",key:"Key_D"},
  {action:"HumanoidJumpButton",key:"Key_Space"},
  {action:"HumanoidSprintButton",key:"Key_LeftShift"},
  {action:"HumanoidCrouchButton",key:"Key_LeftControl"},
];
const footTools:readonly KeyRule[] = [
  {action:"HumanoidPrimaryInteractButton",key:"Key_E"},
  {action:"HumanoidReloadButton",key:"Key_R"},
  {action:"HumanoidToggleFlashlightButton",key:"Key_F"},
];
const driveSrv:readonly KeyRule[] = [
  {action:"IncreaseSpeedButtonPartial",key:"Key_Z"},
  {action:"DecreaseSpeedButtonPartial",key:"Key_S"},
  {action:"SteerLeftButton",key:"Key_Q"},
  {action:"SteerRightButton",key:"Key_D"},
  {action:"AutoBreakBuggyButton",key:"Key_Space"},
];
const shipMove:readonly KeyRule[] = [
  {action:"ForwardThrustButton",key:"Key_Z"},
  {action:"BackwardThrustButton",key:"Key_S"},
  {action:"LeftThrustButton",key:"Key_Q"},
  {action:"RightThrustButton",key:"Key_D"},
  {action:"UpThrustButton",key:"Key_R"},
  {action:"DownThrustButton",key:"Key_F"},
];
const shipNav:readonly KeyRule[] = [
  {action:"HyperSuperCombination",key:"Key_J"},
  {action:"LandingGearToggle",key:"Key_L"},
  {action:"ToggleCargoScoop",key:"Key_H"},
  {action:"SelectTarget",key:"Key_T"},
  {action:"UseBoostJuice",key:"Key_Tab"},
];
/** Action identifiers verified against the game's metadata in public/data/binds.json.
 * No speculative joystick IDs or controller buttons. All keys use an explicit whitelist.
 */
export const PREPARED_TEMPLATES:readonly PreparedTemplate[] = [
  {scope:"ship",usage:"balanced",label:"Pilote AZERTY · polyvalent",
   description:"Propulseurs ZQSD, montée/descente, saut FSD, train, cargo et ciblage. Clavier uniquement.",
   rules:[...shipMove,...shipNav]},
  {scope:"ship",usage:"navigation",label:"Navigation et BGS",
   description:"Saut FSD, carte, prochain système et approche. Conservation des commandes déjà correctement assignées.",
   rules:[
     {action:"HyperSuperCombination",key:"Key_J"},
     {action:"LandingGearToggle",key:"Key_L"},
     {action:"GalaxyMapOpen",key:"Key_M"},
     {action:"SystemMapOpen",key:"Key_N"},
     {action:"ToggleCargoScoop",key:"Key_H"},
   ]},
  {scope:"ship",usage:"combat",label:"Combat spatial",
   description:"Ciblage, groupe de tirs et contre-mesures ; les gâchettes et axes HOTAS ne sont pas modifiés.",
   rules:[
     {action:"SelectTarget",key:"Key_T"},
     {action:"CycleNextHostileTarget",key:"Key_Y"},
     {action:"FireChaffLauncher",key:"Key_C"},
     {action:"DeployHardpointToggle",key:"Key_U"},
     {action:"UseBoostJuice",key:"Key_Tab"},
   ]},
  {scope:"ship",usage:"exploration",label:"Exploration / FSS",
   description:"Navigation, cartes et scanner FSS. Contrôles dédiés présents dans le profil source uniquement.",
   rules:[
     {action:"HyperSuperCombination",key:"Key_J"},
     {action:"GalaxyMapOpen",key:"Key_M"},
     {action:"SystemMapOpen",key:"Key_N"},
     {action:"ExplorationFSSDiscoveryScan",key:"Key_V"},
     {action:"ToggleCargoScoop",key:"Key_H"},
   ]},
  {scope:"srv",usage:"balanced",label:"SRV AZERTY · conduite",
   description:"Conduite ZQSD, frein à main, tourelle et éclairage.",
   rules:[...driveSrv,{action:"ToggleBuggyTurretButton",key:"Key_T"},
     {action:"HeadlightsBuggyButton",key:"Key_F"}]},
  {scope:"srv",usage:"navigation",label:"SRV · reconnaissance BGS",
   description:"Conduite planétaire, navigation et rappel du vaisseau.",
   rules:[...driveSrv,{action:"RecallDismissShip",key:"Key_B"},
     {action:"HeadlightsBuggyButton",key:"Key_F"}]},
  {scope:"srv",usage:"combat",label:"SRV · combat et tourelle",
   description:"Conduite, frein, tourelle et ciblage ; les boutons de tir existants sont préservés.",
   rules:[...driveSrv,{action:"ToggleBuggyTurretButton",key:"Key_T"},
     {action:"SelectTarget_Buggy",key:"Key_Y"}]},
  {scope:"srv",usage:"exploration",label:"SRV · exploration",
   description:"Conduite, éclairage, saut vertical et soute cargo.",
   rules:[...driveSrv,{action:"HeadlightsBuggyButton",key:"Key_F"},
     {action:"VerticalThrustersButton",key:"Key_R"},
     {action:"ToggleCargoScoop_Buggy",key:"Key_H"}]},
  {scope:"foot",usage:"balanced",label:"À pied AZERTY · essentiel",
   description:"ZQSD, course, saut, accroupissement, interaction, rechargement et lampe.",
   rules:[...moveFoot,...footTools]},
  {scope:"foot",usage:"navigation",label:"À pied · confort",
   description:"Déplacements ZQSD et raccourcis essentiels, adaptés à la navigation dans les installations.",
   rules:[...moveFoot,...footTools,{action:"HumanoidOpenAccessPanelButton",key:"Key_T"}]},
  {scope:"foot",usage:"combat",label:"À pied · combat Odyssey",
   description:"ZQSD, saut, course, recharge, protection et équipement de combat.",
   rules:[...moveFoot,{action:"HumanoidReloadButton",key:"Key_R"},
     {action:"HumanoidMeleeButton",key:"Key_V"},
     {action:"HumanoidThrowGrenadeButton",key:"Key_G"},
     {action:"HumanoidToggleShieldsButton",key:"Key_H"}]},
  {scope:"foot",usage:"exploration",label:"À pied · exobiologie",
   description:"Scanner, analyseurs, lampe et déplacements ZQSD.",
   rules:[...moveFoot,{action:"HumanoidPrimaryInteractButton",key:"Key_E"},
     {action:"HumanoidPulseScanButton",key:"Key_V"},
     {action:"HumanoidOpenAccessPanelButton",key:"Key_T"},
     {action:"HumanoidToggleFlashlightButton",key:"Key_F"},
     {action:"HumanoidToggleNightVisionButton",key:"Key_N"}]},
];

function byKey(a: Pick<Bind,"device"|"key"|"modifiers">, key:string):boolean {
  return a.device==="Keyboard" && a.key===key && a.modifiers.length===0;
}
/** Classify rows under game-like submenus using actual action IDs and metadata. */
export const GAME_SECTIONS:Readonly<Record<GameScope,readonly {id:string;label:string}[]>> = {
  ship:[{id:"flight",label:"Pilotage du vaisseau"},
    {id:"navigation",label:"Navigation et FSD"},
    {id:"combat",label:"Combat spatial"},
    {id:"scanner",label:"Scanners et exploration"},
    {id:"other",label:"Autres commandes"}],
  srv:[{id:"drive",label:"Conduite du SRV"},
    {id:"combat",label:"Tourelle et combat"},
    {id:"navigation",label:"Navigation planétaire"},
    {id:"other",label:"Autres commandes"}],
  foot:[{id:"movement",label:"Déplacement à pied"},
    {id:"combat",label:"Combat Odyssey"},
    {id:"tools",label:"Équipement et exploration"},
    {id:"other",label:"Autres commandes"}],
};
export function sectionForAction(scope:GameScope,action:string,meta:BindsMeta):string {
  const group=groupOf(meta,action);
  const cat=meta.controls[action]?.c??"";
  if(scope==="ship"){
    if(group==="Scanners"||/FSS|SAA|scanner|discovery/i.test(action))return "scanner";
    if(cat==="Combat"||/fire|target|weapon|chaff|shield|hardpoint/i.test(action))return "combat";
    if(/thrust|roll|yaw|pitch|flightAssist|throttle/i.test(action))return "flight";
    if(cat==="Navigation"||/hyper|super|map|gear/i.test(action))return "navigation";
    return "other";
  }
  if(scope==="srv"){
    if(cat==="Combat"||/fire|turret|target|weapon/i.test(action))return "combat";
    if(/steer|drive|speed|break|thrust|roll|pitch/i.test(action))return "drive";
    if(cat==="Navigation"||/map|ship|light/i.test(action))return "navigation";
    return "other";
  }
  if(/forward|backward|strafe|sprint|crouch|jump|pitch/i.test(action))return "movement";
  if(/fire|reload|weapon|melee|grenade|shield/i.test(action))return "combat";
  if(/scanner|scan|tool|flashlight|nightvision|interact|access|suit/i.test(action))return "tools";
  return "other";
}

/** Does not replace axes, mouse, HOTAS or Xbox bindings.
 * Replaces a keyboard slot only in the preview for a NEW file; source remains untouched.
 * If a destination key is occupied by an action not being reassigned, skip it.
 */
export function prepareAzerty(
  scope:GameScope, usage:Usage,
  actions:readonly string[], original:readonly Bind[], meta:BindsMeta,
):PreparedPlan {
  const template=PREPARED_TEMPLATES.find(t=>t.scope===scope && t.usage===usage);
  if(!template)throw new Error("Profil préparé inconnu.");
  const sourceActions=new Set(actions);
  const skipped:PreparedSkip[]=[];
  const proposals:PresetAssignment[]=[];
  const seenKeys=new Set<string>();
  let covered=0,available=0;
  for(const rule of template.rules){
    if(!sourceActions.has(rule.action)||scopeForGroup(groupOf(meta,rule.action))!==scope){
      skipped.push({...rule,reason:"Action absente de ce fichier .binds."});continue;
    }
    if(!approvedPreparedKey("Keyboard",rule.key,[])){
      skipped.push({...rule,reason:"Touche non approuvée."});continue;
    }
    available++;
    if(seenKeys.has(rule.key)){
      skipped.push({...rule,reason:"Touche déjà utilisée par le modèle."});continue;
    }
    seenKeys.add(rule.key);
    const current=original.filter(b=>b.action===rule.action && b.slot!=="axis");
    if(current.some(b=>byKey(b,rule.key))){covered++;continue;}
    const primary=current.find(b=>b.slot==="primary");
    const secondary=current.find(b=>b.slot==="secondary");
    // Only keyboard slots may be replaced. A free slot is preferred.
    const choose= !primary?"primary":!secondary?"secondary":
      primary.device==="Keyboard"?"primary":secondary.device==="Keyboard"?"secondary":null;
    if(!choose){
      skipped.push({...rule,reason:"Les deux emplacements appartiennent à d'autres périphériques."});continue;
    }
    const old=choose==="primary"?primary:secondary;
    proposals.push({action:rule.action,slot:choose,device:"Keyboard",key:rule.key,modifiers:[],
      replaceExisting:Boolean(old)});
  }
  // If another action still uses the key and its slot will NOT be replaced, refuse it.
  let changed=true;
  let pending=proposals;
  while(changed){
    changed=false;
    const released=new Set(pending.filter(p=>p.replaceExisting).map(p=>p.action+"|"+p.slot));
    const survivors:PresetAssignment[]=[];
    for(const p of pending){
      const conflict=original.some(b=>
        scopeForGroup(groupOf(meta,b.action))===scope &&
        b.action!==p.action && b.slot!=="axis" && byKey(b,p.key) &&
        !released.has(b.action+"|"+b.slot));
      const staged=survivors.some(s=>s.key===p.key);
      if(conflict||staged){
        skipped.push({action:p.action,key:p.key,reason:"Touche déjà affectée à une autre commande de ce contexte."});
        changed=true;
      }else survivors.push(p);
    }
    pending=survivors;
  }
  return {template,changes:pending,covered,available,skipped,
    warnings:[
      "Profil proposé : ce ne sont pas les touches officielles par défaut d'Elite Dangerous.",
      "Le clavier est le seul périphérique modifié ; axes, HOTAS, souris et manette sont conservés.",
      "La nouvelle configuration n'est créée qu'après confirmation, sans écraser le fichier source.",
    ]};
}
