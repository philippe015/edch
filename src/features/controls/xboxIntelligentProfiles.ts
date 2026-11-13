/** EDCH Cyberpunk Philou v1.6.14 — Xbox visualizer & local, explainable suggestions.
 * Never invents Pad_ IDs, remaps axes, writes files, or accesses live controller state.
 */
import { type Bind, type BindsMeta, deviceInfo, groupOf, padControl } from "./binds.js";
import { bindingKey, inputCatalog, type PresetAssignment } from "./presetAdvisor.js";
import { scopeForGroup, type GameScope, type Usage } from "./scopedProfiles.js";

export interface XboxControl {
  id: string; label: string; x: number; y: number; kind: "button" | "trigger" | "stick" | "axis";
}
export const XBOX_CONTROLS:readonly XboxControl[]=[
  {id:"LTrigger",label:"LT",x:27,y:9,kind:"trigger"},
  {id:"RTrigger",label:"RT",x:73,y:9,kind:"trigger"},
  {id:"LBumper",label:"LB",x:27,y:21,kind:"button"},
  {id:"RBumper",label:"RB",x:73,y:21,kind:"button"},
  {id:"LThumb",label:"LS",x:30,y:43,kind:"stick"},
  {id:"LStickX",label:"LS X",x:17,y:39,kind:"axis"},
  {id:"LStickY",label:"LS Y",x:30,y:60,kind:"axis"},
  {id:"RThumb",label:"RS",x:60,y:65,kind:"stick"},
  {id:"RStickX",label:"RS X",x:47,y:68,kind:"axis"},
  {id:"RStickY",label:"RS Y",x:60,y:83,kind:"axis"},
  {id:"DPadUp",label:"↑",x:39,y:57,kind:"button"},
  {id:"DPadDown",label:"↓",x:39,y:75,kind:"button"},
  {id:"DPadLeft",label:"←",x:34,y:66,kind:"button"},
  {id:"DPadRight",label:"→",x:44,y:66,kind:"button"},
  {id:"Y",label:"Y",x:71,y:37,kind:"button"},
  {id:"X",label:"X",x:65,y:47,kind:"button"},
  {id:"B",label:"B",x:77,y:47,kind:"button"},
  {id:"A",label:"A",x:71,y:57,kind:"button"},
  {id:"Back",label:"View",x:44,y:39,kind:"button"},
  {id:"Start",label:"Menu",x:56,y:39,kind:"button"},
  {id:"Guide",label:"Xbox",x:50,y:29,kind:"button"},
];
const CONTROLS=new Set(XBOX_CONTROLS.map(c=>c.id));
const BUTTONS=new Set(XBOX_CONTROLS.filter(c=>c.kind!=="axis").map(c=>c.id));

/** Generic GamePad/XB360 bindings are understood as Xbox-style only if identifiable.
 * Sony and non-Xbox named hardware are explicitly excluded.
 */
export function isXboxDevice(device:string, meta:BindsMeta):boolean {
  const mapped=meta.vidpid?.[device.toUpperCase()]??"";
  const name=meta.devices?.[device]?.label??"";
  const combined=device+" "+mapped+" "+name;
  if(/dualshock|playstation|ps[345]|gioteck|logitech|saitek|switch|nintendo/i.test(combined))return false;
  if(/^(?:GamePad|XB360 Pad|Xbox[\w -]*|XInput[\w -]*|Pad[\w -]*)$/i.test(device))return true;
  return deviceInfo(meta,device).kind==="gamepad" && /xbox|xb360|xinput/i.test(combined);
}
export function xboxControl(device:string,key:string,meta:BindsMeta):string|null {
  if(!isXboxDevice(device,meta))return null;
  const c=padControl(device,key)?.replace(/[+-]$/,"")??null;
  return c && CONTROLS.has(c)?c:null;
}
export interface XboxDisplayedAssignment {
  action:string; slot:Bind["slot"]; device:string; key:string;
  modifiers:string[]; inverted:boolean; status:"existing"|"draft"; isModifier:boolean;
}
export interface XboxControlSummary {
  existing:XboxDisplayedAssignment[];
  draft:XboxDisplayedAssignment[];
}
/** Original axis bindings are preserved, including their raw signed direction. */
export function xboxAssignments(
  control:string,scope:GameScope,binds:readonly Bind[],
  staged:readonly PresetAssignment[],meta:BindsMeta,
):XboxControlSummary {
  if(!CONTROLS.has(control))return {existing:[],draft:[]};
  const context=(action:string)=>scopeForGroup(groupOf(meta,action))===scope;
  const overridden=new Set(staged.filter(s=>s.replaceExisting).map(s=>s.action+"|"+s.slot));
  const wanted=(b:Pick<Bind,"device"|"key"|"modifiers">)=>(
    xboxControl(b.device,b.key,meta)===control ||
    b.modifiers.some(m=>xboxControl(m.device,m.key,meta)===control)
  );
  const toItem=(b:Bind,status:"existing"|"draft"):XboxDisplayedAssignment=>({
    action:b.action,slot:b.slot,device:b.device,key:b.key,
    modifiers:b.modifiers.map(m=>m.device+" : "+m.key),
    inverted:Boolean(b.inverted),status,
    isModifier:xboxControl(b.device,b.key,meta)!==control,
  });
  const existing=binds.filter(b=>context(b.action)&&wanted(b)&&
    !overridden.has(b.action+"|"+b.slot)).map(b=>toItem(b,"existing"));
  const draft=staged.filter(b=>context(b.action)&&wanted(b))
    .map(b=>toItem({...b,inverted:false} as Bind,"draft"));
  return {existing,draft};
}
export function xboxUnrecognized(binds:readonly Bind[],meta:BindsMeta):Bind[] {
  return binds.filter(b=>isXboxDevice(b.device,meta) && !xboxControl(b.device,b.key,meta));
}
interface XboxRule {action:string; prefer:readonly string[]; peers?:readonly string[]}
const RULES:Record<GameScope,Record<Usage,readonly XboxRule[]>>={
  ship:{
    balanced:[
      {action:"PrimaryFire",prefer:["RTrigger"],peers:["BuggyPrimaryFireButton","HumanoidPrimaryFireButton"]},
      {action:"SecondaryFire",prefer:["LTrigger"],peers:["BuggySecondaryFireButton"]},
      {action:"SelectTarget",prefer:["A"],peers:["SelectTarget_Buggy"]},
      {action:"HyperSuperCombination",prefer:["Y"]},
      {action:"LandingGearToggle",prefer:["DPadDown"]},
      {action:"UseBoostJuice",prefer:["B"]},
    ],
    navigation:[
      {action:"HyperSuperCombination",prefer:["Y"]},
      {action:"LandingGearToggle",prefer:["DPadDown"]},
      {action:"TargetNextRouteSystem",prefer:["DPadRight"]},
      {action:"GalaxyMapOpen",prefer:["Back"]},
      {action:"ToggleCargoScoop",prefer:["X"]},
    ],
    combat:[
      {action:"PrimaryFire",prefer:["RTrigger"],peers:["BuggyPrimaryFireButton","HumanoidPrimaryFireButton"]},
      {action:"SecondaryFire",prefer:["LTrigger"],peers:["BuggySecondaryFireButton"]},
      {action:"SelectTarget",prefer:["A"],peers:["SelectTarget_Buggy"]},
      {action:"DeployHardpointToggle",prefer:["Y"]},
      {action:"FireChaffLauncher",prefer:["LBumper"]},
    ],
    exploration:[
      {action:"HyperSuperCombination",prefer:["Y"]},
      {action:"GalaxyMapOpen",prefer:["Back"]},
      {action:"SystemMapOpen",prefer:["Start"]},
      {action:"ToggleCargoScoop",prefer:["X"]},
      {action:"ExplorationFSSDiscoveryScan",prefer:["RBumper"]},
    ],
  },
  srv:{
    balanced:[
      {action:"BuggyPrimaryFireButton",prefer:["RTrigger"],peers:["PrimaryFire","HumanoidPrimaryFireButton"]},
      {action:"AutoBreakBuggyButton",prefer:["B"]},
      {action:"ToggleBuggyTurretButton",prefer:["Y"]},
      {action:"SelectTarget_Buggy",prefer:["A"],peers:["SelectTarget"]},
      {action:"HeadlightsBuggyButton",prefer:["DPadRight"]},
    ],
    navigation:[
      {action:"AutoBreakBuggyButton",prefer:["B"]},
      {action:"HeadlightsBuggyButton",prefer:["DPadRight"]},
      {action:"RecallDismissShip",prefer:["Y"]},
      {action:"GalaxyMapOpen_Buggy",prefer:["Back"],peers:["GalaxyMapOpen"]},
      {action:"SelectTarget_Buggy",prefer:["A"],peers:["SelectTarget"]},
    ],
    combat:[
      {action:"BuggyPrimaryFireButton",prefer:["RTrigger"],peers:["PrimaryFire"]},
      {action:"BuggySecondaryFireButton",prefer:["LTrigger"],peers:["SecondaryFire"]},
      {action:"ToggleBuggyTurretButton",prefer:["Y"]},
      {action:"SelectTarget_Buggy",prefer:["A"],peers:["SelectTarget"]},
      {action:"AutoBreakBuggyButton",prefer:["B"]},
    ],
    exploration:[
      {action:"AutoBreakBuggyButton",prefer:["B"]},
      {action:"HeadlightsBuggyButton",prefer:["DPadRight"]},
      {action:"VerticalThrustersButton",prefer:["A"],peers:["HumanoidJumpButton"]},
      {action:"ToggleCargoScoop_Buggy",prefer:["X"],peers:["ToggleCargoScoop"]},
      {action:"RecallDismissShip",prefer:["Y"]},
    ],
  },
  foot:{
    balanced:[
      {action:"HumanoidJumpButton",prefer:["A"]},
      {action:"HumanoidPrimaryInteractButton",prefer:["Y"]},
      {action:"HumanoidReloadButton",prefer:["X"]},
      {action:"HumanoidSprintButton",prefer:["LThumb"]},
      {action:"HumanoidCrouchButton",prefer:["B"]},
    ],
    navigation:[
      {action:"HumanoidJumpButton",prefer:["A"]},
      {action:"HumanoidPrimaryInteractButton",prefer:["Y"]},
      {action:"HumanoidSprintButton",prefer:["LThumb"]},
      {action:"HumanoidToggleFlashlightButton",prefer:["DPadRight"]},
      {action:"HumanoidPulseScanButton",prefer:["RBumper"]},
    ],
    combat:[
      {action:"HumanoidPrimaryFireButton",prefer:["RTrigger"],peers:["PrimaryFire","BuggyPrimaryFireButton"]},
      {action:"HumanoidReloadButton",prefer:["X"]},
      {action:"HumanoidJumpButton",prefer:["A"]},
      {action:"HumanoidCrouchButton",prefer:["B"]},
      {action:"HumanoidSprintButton",prefer:["LThumb"]},
    ],
    exploration:[
      {action:"HumanoidJumpButton",prefer:["A"]},
      {action:"HumanoidPulseScanButton",prefer:["RBumper"]},
      {action:"HumanoidToggleNightVisionButton",prefer:["DPadUp"]},
      {action:"HumanoidToggleFlashlightButton",prefer:["DPadRight"]},
      {action:"HumanoidPrimaryInteractButton",prefer:["Y"]},
    ],
  },
};

export interface XboxSuggestion {
  assignment:PresetAssignment;
  reason:string;
  confidence:"cross-context"|"convention";
}
export interface XboxProfilePlan {
  scope:GameScope;usage:Usage;covered:number;relevant:number;
  suggestions:XboxSuggestion[];changes:PresetAssignment[];
  skipped:string[];warnings:string[];controllerNames:string[];
}
export const XBOX_STYLES:Readonly<Record<Usage,{name:string;description:string}>>={
  balanced:{name:"Polyvalent",description:"Commandes essentielles, sans modifier les axes."},
  navigation:{name:"Navigation / BGS",description:"Accès aux cartes, déplacements et navigation."},
  combat:{name:"Combat",description:"Priorité au tir, aux cibles et aux actions de combat."},
  exploration:{name:"Exploration",description:"Scanners, éclairage et exploration planétaire."},
};

/** Picks only an INPUT PRESENT in source file, preserving used inputs in the same scope.
 * Semantic peer bindings rank first; conventional Xbox layout is a weaker second choice.
 * This is an offline heuristic, not automatic AI and not a claim about Frontier defaults.
 */
export function recommendXboxProfile(
  scope:GameScope,usage:Usage,actions:readonly string[],
  binds:readonly Bind[],meta:BindsMeta,
):XboxProfilePlan {
  const allowed=new Set(actions);
  const sourceInputs=inputCatalog(binds).filter(b=>isXboxDevice(b.device,meta)&&
    xboxControl(b.device,b.key,meta)!==null&&!b.modifiers.length&&
    BUTTONS.has(xboxControl(b.device,b.key,meta)!));
  const suggestions:XboxSuggestion[]=[];const skipped:string[]=[];
  let covered=0,relevant=0;
  const controllers=[...new Set(sourceInputs.map(b=>b.device))];
  const preferredDevice=controllers[0];
  // Never combine buttons from different detected controllers in one prepared profile.
  const pool=sourceInputs.filter(b=>b.device===preferredDevice);
  for(const rule of RULES[scope][usage]){
    if(!allowed.has(rule.action)||scopeForGroup(groupOf(meta,rule.action))!==scope){
      skipped.push(rule.action+" : commande absente du fichier .binds");continue;
    }
    relevant++;
    if(binds.some(b=>b.action===rule.action&&b.slot!=="axis"&&
      isXboxDevice(b.device,meta))){
      covered++;continue;
    }
    const existing=binds.filter(b=>b.action===rule.action&&b.slot!=="axis");
    const slot: "primary"|"secondary"|null=
      !existing.some(b=>b.slot==="primary")?"primary":
      !existing.some(b=>b.slot==="secondary")?"secondary":null;
    if(!slot){skipped.push(rule.action+" : emplacements occupés");continue;}
    const candidates=pool.map(b=>{
      const control=xboxControl(b.device,b.key,meta);
      const semantic=Boolean(rule.peers?.includes(b.action));
      const preference=control?rule.prefer.indexOf(control):-1;
      return {b,control,semantic,preference,rank:semantic?100:(preference>=0?60-preference:0)};
    }).filter(c=>c.rank>0).sort((a,b)=>b.rank-a.rank||
      a.b.key.localeCompare(b.b.key,"fr"));
    const match=candidates.find(c=>{
      const sig=bindingKey(c.b);
      return !binds.some(other=>other.slot!=="axis"&&other.action!==rule.action&&
        scopeForGroup(groupOf(meta,other.action))===scope&&bindingKey(other)===sig)
        &&!suggestions.some(prev=>bindingKey(prev.assignment)===sig);
    });
    if(!match){
      skipped.push(rule.action+" : aucun bouton reconnu et libre dans ce contexte");continue;
    }
    const assign:PresetAssignment={action:rule.action,slot,device:match.b.device,
      key:match.b.key,modifiers:[],replaceExisting:false};
    suggestions.push({assignment:assign,confidence:match.semantic?"cross-context":"convention",
      reason:match.semantic
        ?"Même fonction retrouvée dans un autre contexte de jeu."
        :"Suggestion ergonomique selon le profil choisi ; à confirmer dans le jeu."});
  }
  const warnings=[
    "Recommandations locales explicables, pas une IA générative ni un profil officiel Frontier.",
    "Seulement les boutons déjà enregistrés dans le .binds ; aucun axe ou numéro de bouton inventé.",
    "Les touches utilisées dans le même contexte restent intactes. Aucun fichier modifié sans confirmation.",
  ];
  if(!pool.length)warnings.push("Aucune manette Xbox compatible reconnue dans ce profil. Configure d'abord quelques commandes dans Elite Dangerous.");
  if(!suggestions.length)warnings.push("Aucune affectation supplémentaire sûre disponible. Les réglages existants sont conservés.");
  if(controllers.length>1)warnings.push("Plusieurs manettes détectées : suggestions limitées à "+preferredDevice+".");
  return {scope,usage,covered,relevant,suggestions,changes:suggestions.map(s=>s.assignment),
    skipped,warnings,controllerNames:controllers};
}
