/** EDCH Cyberpunk Philou v1.6.21 — full, reviewed Odyssey On Foot AZERTY proposals.
 * Covers all known OnFoot actions with a report, without inventing axes/devices.
 * Keys are Cyberpunk Philou choices, not Frontier's official defaults.
 */
import {type Bind,type BindsMeta,groupOf} from "./binds.js";
import {type PresetAssignment} from "./presetAdvisor.js";
import {approvedCapturedKeyboardKey} from "./footDirectCapture.js";
import {recommendFootMouse} from "./virtualFootMouse.js";
import {scopeForGroup,type Usage} from "./scopedProfiles.js";

export interface FootRule {
  action:string;key:string;group:"essential"|"equipment"|"navigation"|"advanced";
}
const E=(action:string,key:string,group:FootRule["group"]="essential"):FootRule=>({action,key,group});
/** Every key appears at most once; axes remain owned by the original game profile. */
export const FULL_FOOT_AZERTY_RULES:readonly FootRule[]=[
  E("HumanoidForwardButton","Key_Z"),E("HumanoidBackwardButton","Key_S"),
  E("HumanoidStrafeLeftButton","Key_Q"),E("HumanoidStrafeRightButton","Key_D"),
  E("HumanoidJumpButton","Key_Space"),E("HumanoidSprintButton","Key_LeftShift"),
  E("HumanoidCrouchButton","Key_LeftControl"),E("HumanoidWalkButton","Key_RightShift"),
  E("HumanoidPrimaryInteractButton","Key_E"),
  E("HumanoidReloadButton","Key_R"),E("HumanoidToggleFlashlightButton","Key_F"),
  E("HumanoidSwitchToRechargeTool","Key_3","equipment"),
  E("HumanoidSecondaryInteractButton","Key_T","equipment"),
  E("HumanoidMeleeButton","Key_V","equipment"),E("HumanoidThrowGrenadeButton","Key_G","equipment"),
  E("HumanoidToggleShieldsButton","Key_H","equipment"),
  E("HumanoidToggleNightVisionButton","Key_N","equipment"),
  E("HumanoidPulseScanButton","Key_B","equipment"),
  E("HumanoidSelectPrimaryWeaponButton","Key_1","equipment"),
  E("HumanoidSelectSecondaryWeaponButton","Key_2","equipment"),
  E("HumanoidSelectUtilityWeaponButton","Key_4","equipment"),
  E("HumanoidSwitchToCompAnalyser","Key_5","equipment"),
  E("HumanoidSwitchToSuitTool","Key_6","equipment"),
  E("HumanoidHealthPack","Key_7","equipment"),
  E("HumanoidBattery","Key_8","equipment"),
  E("HumanoidSelectFragGrenade","Key_9","equipment"),
  E("HumanoidSelectEMPGrenade","Key_0","equipment"),
  E("HumanoidSelectShieldGrenade","Key_F5","equipment"),
  E("HumanoidOpenAccessPanelButton","Key_P","equipment"),
  E("HumanoidHideWeaponButton","Key_U","equipment"),
  E("HumanoidItemWheelButton","Key_I","equipment"),
  E("HumanoidEmoteWheelButton","Key_O","advanced"),
  E("HumanoidToggleToolModeButton","Key_F6","equipment"),
  E("HumanoidToggleMissionHelpPanelButton","Key_F2","advanced"),
  E("HumanoidToggleJumpAssistModuleButton","Key_F7","advanced"),
  E("HumanoidToggleShieldBoosterModuleButton","Key_F8","advanced"),
  E("HumanoidToggleWeaponBoosterModuleButton","Key_F9","advanced"),
  E("HumanoidSelectNextWeaponButton","Key_F10","advanced"),
  E("HumanoidSelectPreviousWeaponButton","Key_F11","advanced"),
  E("HumanoidSelectNextGrenadeTypeButton","Key_F12","advanced"),
  E("HumanoidSelectPreviousGrenadeTypeButton","Key_F3","advanced"),
  E("GalaxyMapOpen_Humanoid","Key_M","navigation"),
  E("SystemMapOpen_Humanoid","Key_J","navigation"),
  E("QuickCommsPanel_Humanoid","Key_K","navigation"),
  E("FocusCommsPanel_Humanoid","Key_L","navigation"),
  E("HumanoidActivateSuitAbilityButton","Key_F1","advanced"),
  E("HumanoidUtilityWheelCycleMode","Key_F4","advanced"),
  E("HumanoidConflictContextualUIButton","Key_C","advanced"),
  E("HumanoidItemWheelButton_XLeft","Key_LeftArrow","navigation"),
  E("HumanoidItemWheelButton_XRight","Key_RightArrow","navigation"),
  E("HumanoidItemWheelButton_YUp","Key_UpArrow","navigation"),
  E("HumanoidItemWheelButton_YDown","Key_DownArrow","navigation"),
  E("HumanoidEmoteSlot1","Key_Numpad_1","advanced"),
  E("HumanoidEmoteSlot2","Key_Numpad_2","advanced"),
  E("HumanoidEmoteSlot3","Key_Numpad_3","advanced"),
  E("HumanoidEmoteSlot4","Key_Numpad_4","advanced"),
  E("HumanoidEmoteSlot5","Key_Numpad_5","advanced"),
  E("HumanoidEmoteSlot6","Key_Numpad_6","advanced"),
  E("HumanoidEmoteSlot7","Key_Numpad_7","advanced"),
  E("HumanoidEmoteSlot8","Key_Numpad_8","advanced"),
  E("HumanoidResetPowerDistributionButton","Key_Numpad_0","advanced"),
  E("HumanoidIncreaseEnginesPowerButton","Key_Numpad_9","advanced"),
  E("HumanoidIncreaseSystemsPowerButton","Key_PageUp","advanced"),
  E("HumanoidIncreaseWeaponsPowerButton","Key_PageDown","advanced"),
  E("HumanoidPitchUpButton","Key_Insert","advanced"),
  E("HumanoidPitchDownButton","Key_Delete","advanced"),
  E("HumanoidRotateLeftButton","Key_Home","advanced"),
  E("HumanoidRotateRightButton","Key_End","advanced"),
];
const rules=FULL_FOOT_AZERTY_RULES;
export interface FullFootSkip {action:string;key:string;reason:string}
export interface FullFootPlan {
  usage:Usage;
  changes:PresetAssignment[];
  covered:number;
  available:number;
  skipped:FullFootSkip[];
  unassigned:string[];
  preservedAxes:number;
  allActions:number;
  warnings:string[];
}
const isKey=(b:Pick<Bind,"device"|"key"|"modifiers">,key:string)=>
  b.device==="Keyboard"&&b.key===key&&b.modifiers.length===0;
export function prepareCompleteFootAzerty(
  usage:Usage,actions:readonly string[],original:readonly Bind[],meta:BindsMeta,
):FullFootPlan {
  const present=new Set(actions);
  const desiredKeys=new Set<string>();
  const candidates:PresetAssignment[]=[];
  const skipped:FullFootSkip[]=[];
  let covered=0,available=0;
  const footActions=actions.filter(a=>scopeForGroup(groupOf(meta,a))==="foot");
  const order=usage==="combat"
    ?["essential","equipment","advanced","navigation"]
    :usage==="exploration"||usage==="navigation"
      ?["essential","navigation","equipment","advanced"]
      :["essential","equipment","navigation","advanced"];
  for(const rule of [...rules].sort((a,b)=>order.indexOf(a.group)-order.indexOf(b.group))){
    if(!present.has(rule.action)||scopeForGroup(groupOf(meta,rule.action))!=="foot"){
      skipped.push({...rule,reason:"Commande absente du fichier Odyssey sélectionné"});continue;
    }
    available++;
    if(!approvedCapturedKeyboardKey("Keyboard",rule.key,[])){
      skipped.push({...rule,reason:"Code clavier non reconnu ou non pris en charge"});continue;
    }
    if(desiredKeys.has(rule.key)){
      skipped.push({...rule,reason:"Touche déjà réservée dans le préréglage"});continue;
    }
    desiredKeys.add(rule.key);
    // Do not create a keyboard mapping for secondary interaction if the game
    // already exposes Mouse_3: the dedicated mouse planner handles that.
    if(rule.action==="HumanoidSecondaryInteractButton" &&
      original.some(b=>b.device==="Mouse"&&b.key==="Mouse_3")){
      skipped.push({...rule,reason:"Clic molette déjà présent ; priorité à la souris"});continue;
    }
    const current=original.filter(b=>b.action===rule.action&&b.slot!=="axis");
    if(current.some(b=>isKey(b,rule.key))){covered++;continue;}
    const primary=current.find(b=>b.slot==="primary"),secondary=current.find(b=>b.slot==="secondary");
    const chosen=!primary?"primary":primary.device==="Keyboard"?"primary":
      !secondary?"secondary":secondary.device==="Keyboard"?"secondary":null;
    if(!chosen){skipped.push({...rule,reason:"Deux emplacements occupés par des périphériques différents"});continue;}
    const old=chosen==="primary"?primary:secondary;
    candidates.push({action:rule.action,slot:chosen,device:"Keyboard",key:rule.key,
      modifiers:[],replaceExisting:Boolean(old)});
  }
  // Fixed-point filtering: only consider a currently used key freed when
  // its corresponding source slot survives as an explicit replacement.
  let pending=candidates;
  for(let attempts=0;attempts<candidates.length+1;attempts++){
    const released=new Set(pending.filter(c=>c.replaceExisting).map(c=>c.action+"|"+c.slot));
    const next:PresetAssignment[]=[];
    let changed=false;
    const stagedKeys=new Set<string>();
    for(const c of pending){
      const conflict=original.find(b=>
        scopeForGroup(groupOf(meta,b.action))==="foot"&&b.slot!=="axis"&&
        !(b.action===c.action&&b.slot===c.slot)&&isKey(b,c.key)&&
        !released.has(b.action+"|"+b.slot));
      if(conflict||stagedKeys.has(c.key)){
        skipped.push({action:c.action,key:c.key,reason:conflict
          ?"Touche conservée par une autre commande à pied : "+conflict.action
          :"Touche déjà attribuée par une proposition"});
        changed=true;
      }else{next.push(c);stagedKeys.add(c.key);}
    }
    pending=next;
    if(!changed)break;
  }
  // Mouse buttons are proposed only when the physical code exists in this source.
  // Prefer Mouse_1=fire, Mouse_2=aim, Mouse_3=secondary interaction.
  const mouse=recommendFootMouse(actions,original,meta);
  const reserved=new Set(pending.map(c=>c.action+"|"+c.slot));
  for(const m of mouse.changes){
    if(reserved.has(m.action+"|"+m.slot)){
      const alternate=m.slot==="primary"?"secondary":"primary";
      const slotBusy=original.some(b=>b.action===m.action&&b.slot===alternate);
      if(slotBusy||reserved.has(m.action+"|"+alternate)){
        skipped.push({action:m.action,key:m.key,reason:"Emplacements déjà réservés pour clavier et souris"});continue;
      }
      pending.push({...m,slot:alternate});
      reserved.add(m.action+"|"+alternate);
    }else{pending.push(m);reserved.add(m.action+"|"+m.slot);}
  }
  const resultBindings=new Set(original.filter(b=>b.slot!=="axis")
    .filter(b=>!pending.some(c=>c.action===b.action&&c.slot===b.slot&&c.replaceExisting))
    .map(b=>b.action));
  pending.forEach(c=>resultBindings.add(c.action));
  const unassigned=footActions.filter(a=>!resultBindings.has(a) &&
    !/Axis$/.test(a));
  const axes=original.filter(b=>b.slot==="axis"&&scopeForGroup(groupOf(meta,b.action))==="foot").length;
  return {
    usage,changes:pending,covered:covered+mouse.covered,
    available:available+mouse.relevant,
    skipped,unassigned,preservedAxes:axes,allActions:footActions.length,
    warnings:[
      "Réglages Cyberpunk Philou, et non réglages officiels Frontier.",
      "Les axes, les mouvements de souris, les boutons HOTAS/Xbox et les fichiers originaux sont conservés.",
      "Les commandes absentes, les conflits et les commandes sans touche sont indiqués avant tout enregistrement.",
    ],
  };
}
