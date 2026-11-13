/** Cyberpunk Philou v1.6.16 — on-foot mouse bindings visualizer.
 * Reads real Elite Dangerous .binds; cannot modify the game or its settings.
 */
import { type Bind, type BindsMeta, groupOf } from "./binds.js";
import type { PresetAssignment } from "./presetAdvisor.js";
import { scopeForGroup } from "./scopedProfiles.js";

export interface MouseVisualControl {
  id:string;
  label:string;
  detail:string;
  kind:"button"|"wheel"|"axis";
}
export const FOOT_MOUSE_CONTROLS:readonly MouseVisualControl[]=[
  {id:"Mouse_1",label:"Gauche",detail:"Clic gauche",kind:"button"},
  {id:"Mouse_2",label:"Droit",detail:"Clic droit",kind:"button"},
  {id:"Mouse_3",label:"Milieu",detail:"Clic molette",kind:"button"},
  {id:"Mouse_4",label:"Latéral 1",detail:"Bouton latéral 4",kind:"button"},
  {id:"Mouse_5",label:"Latéral 2",detail:"Bouton latéral 5",kind:"button"},
  {id:"Pos_Mouse_ZAxis",label:"Molette ↑",detail:"Défilement haut",kind:"wheel"},
  {id:"Neg_Mouse_ZAxis",label:"Molette ↓",detail:"Défilement bas",kind:"wheel"},
  {id:"Mouse_XAxis",label:"Axe X",detail:"Déplacement horizontal",kind:"axis"},
  {id:"Mouse_YAxis",label:"Axe Y",detail:"Déplacement vertical",kind:"axis"},
];
export interface MouseVisualAssignment {
  action:string;
  slot:Bind["slot"];
  device:string;
  key:string;
  modifiers:string[];
  kind:"existing"|"draft";
  isModifier:boolean;
}
export interface MouseVisualSummary {
  existing:MouseVisualAssignment[];
  draft:MouseVisualAssignment[];
}
export function isMouseDevice(device:string):boolean { return device==="Mouse"; }
export function isMouseInput(key:string):boolean {
  return /^(?:(?:Pos|Neg)_)?Mouse_(?:[1-9]\d*|[XYZ]Axis)$/.test(key);
}
/** Signed scroll directions are displayed individually. Unqualified Mouse_ZAxis
 * is shown on both scroll directions with the original unsuffixed code intact.
 */
export function mouseControlMatches(controlId:string,device:string,key:string):boolean {
  if(!isMouseDevice(device))return false;
  if(controlId==="Pos_Mouse_ZAxis"||controlId==="Neg_Mouse_ZAxis")
    return key===controlId||key==="Mouse_ZAxis";
  if(controlId==="Mouse_XAxis"||controlId==="Mouse_YAxis")
    return key===controlId||key==="Pos_"+controlId||key==="Neg_"+controlId;
  return controlId===key;
}
export function mouseAssignments(
  controlId:string,original:readonly Bind[],staged:readonly PresetAssignment[],meta:BindsMeta,
):MouseVisualSummary {
  if(!FOOT_MOUSE_CONTROLS.some(c=>c.id===controlId))return {existing:[],draft:[]};
  const inScope=(action:string)=>scopeForGroup(groupOf(meta,action))==="foot";
  const replaced=new Set(staged.filter(s=>s.replaceExisting).map(s=>s.action+"|"+s.slot));
  const matches=(b:Pick<Bind,"device"|"key"|"modifiers">)=>
    mouseControlMatches(controlId,b.device,b.key) ||
      b.modifiers.some(m=>mouseControlMatches(controlId,m.device,m.key));
  const toDisplay=(b:Bind,kind:"existing"|"draft"):MouseVisualAssignment=>({
    action:b.action,slot:b.slot,device:b.device,key:b.key,
    modifiers:b.modifiers.map(m=>m.device+" / "+m.key),kind,
    isModifier:!mouseControlMatches(controlId,b.device,b.key),
  });
  const existing=original.filter(b=>inScope(b.action)&&matches(b)&&!replaced.has(b.action+"|"+b.slot))
    .map(b=>toDisplay(b,"existing"));
  const draft=staged.filter(b=>inScope(b.action)&&matches(b))
    .map(b=>toDisplay({...b,inverted:false} as Bind,"draft"));
  return {existing,draft};
}
/** Candidate inputs only from the real .binds. Only digital buttons can be staged.
 * Axes and scroll movement are informational unless the game exposed them as a digital slot.
 */
export function digitalMouseInputs(binds:readonly Bind[]):Bind[] {
  const keys=new Set<string>();
  return binds.filter(b=>{
    if(b.slot==="axis"||!isMouseDevice(b.device)||!/^Mouse_[1-9]\d*$/.test(b.key)||b.modifiers.length)return false;
    const signature=b.device+"|"+b.key;
    if(keys.has(signature))return false;
    keys.add(signature);return true;
  });
}

/** Optional local suggestions for Odyssey on foot. Never fabricates a mouse code.
 * Only unused digital Mouse_1/2/3 already found in the source .binds qualify.
 * Existing axes, keyboard and mouse bindings are never replaced.
 */
export interface FootMouseAdvice {
  changes:PresetAssignment[];
  covered:number;
  relevant:number;
  skipped:string[];
}
export function recommendFootMouse(
  actions:readonly string[],binds:readonly Bind[],meta:BindsMeta,
):FootMouseAdvice {
  const targets:readonly [string,string][]=[
    ["HumanoidPrimaryFireButton","Mouse_1"],
    ["HumanoidZoomButton","Mouse_2"],
    ["HumanoidSecondaryInteractButton","Mouse_3"],
  ];
  const allowed=new Set(actions);
  const sourceInputs=digitalMouseInputs(binds);
  const changes:PresetAssignment[]=[];
  const skipped:string[]=[];
  let covered=0,relevant=0;
  for(const [action,key] of targets){
    if(!allowed.has(action)||scopeForGroup(groupOf(meta,action))!=="foot"){
      skipped.push(action+" : action non disponible dans ce .binds");continue;
    }
    relevant++;
    if(binds.some(b=>b.action===action&&b.device==="Mouse"&&
      b.slot!=="axis"&&b.key===key&&b.modifiers.length===0)){
      covered++;continue;
    }
    if(binds.some(b=>b.action===action&&b.device==="Mouse"&&b.slot!=="axis")){
      skipped.push(action+" : une autre touche souris est déjà attribuée");continue;
    }
    if(!sourceInputs.some(b=>b.key===key)){
      skipped.push(key+" : bouton absent du fichier .binds");continue;
    }
    const occupied=binds.filter(b=>b.action===action&&b.slot!=="axis");
    const slot:"primary"|"secondary"|null =
      !occupied.some(b=>b.slot==="primary")?"primary":
      !occupied.some(b=>b.slot==="secondary")?"secondary":null;
    if(!slot){skipped.push(action+" : emplacements occupés");continue;}
    if(binds.some(b=>b.slot!=="axis"&&b.action!==action&&
      scopeForGroup(groupOf(meta,b.action))==="foot"&&b.device==="Mouse"&&
      b.key===key&&b.modifiers.length===0)){
      skipped.push(key+" : déjà utilisé à pied");continue;
    }
    if(changes.some(c=>c.key===key)){
      skipped.push(key+" : doublon dans la proposition");continue;
    }
    changes.push({action,slot,device:"Mouse",key,modifiers:[],replaceExisting:false});
  }
  return {changes,covered,relevant,skipped};
}
