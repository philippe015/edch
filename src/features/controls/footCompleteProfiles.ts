/** Cyberpunk Philou v1.6.21 — named, reviewable Odyssey on-foot AZERTY plans.
 * These are ergonomic proposals, NOT official Frontier defaults. A plan lists every
 * digital OnFoot action and explicitly reports those it cannot safely assign.
 */
import {type Bind,type BindsMeta,groupOf} from "./binds.js";
import {type PresetAssignment} from "./presetAdvisor.js";
import {type Usage,scopeForGroup} from "./scopedProfiles.js";
import {approvedCapturedKeyboardKey} from "./footDirectCapture.js";
import {type PreparedPlan,type PreparedSkip,type PreparedTemplate,type KeyRule} from "./preparedProfiles.js";

export const FOOT_NAMED_PRESET:Readonly<Record<Usage,string>>={
  balanced:"EDCH_PIED_AZERTY",
  navigation:"EDCH_PIED_NAVIGATION",
  combat:"EDCH_PIED_COMBAT",
  exploration:"EDCH_PIED_EXPLORATION",
};
export const FOOT_MANUAL_PRESET="EDCH_PIED_PERSONNALISE";
export function suggestedPresetName(
  scope:"ship"|"srv"|"foot",family:"azerty"|"hotas"|"xbox",
  usage:Usage,prepared:boolean,
):string {
  if(scope==="foot"&&family==="azerty")
    return prepared?FOOT_NAMED_PRESET[usage]:FOOT_MANUAL_PRESET;
  const device=family==="azerty"?"AZERTY":family==="hotas"?"X52":"XBOX";
  const name=scope==="ship"?"VAISSEAU":scope==="srv"?"SRV":"PIED";
  const mode=usage==="balanced"?"POLYVALENT":usage==="navigation"?"NAV":usage==="combat"?"COMBAT":"EXPLORATION";
  return `EDCH_${name}_${device}_${mode}`;
}

/** Safe, distinct key propositions that cover ordinary Odyssey movement, inventory,
 * combat, equipment, navigation and utility keys. Mouse is handled separately from
 * existing hardware IDs. It intentionally leaves analog axes untouched.
 */
export const FOOT_ESSENTIAL_RULES:readonly KeyRule[]=[
  {action:"HumanoidForwardButton",key:"Key_Z"},
  {action:"HumanoidBackwardButton",key:"Key_S"},
  {action:"HumanoidStrafeLeftButton",key:"Key_Q"},
  {action:"HumanoidStrafeRightButton",key:"Key_D"},
  {action:"HumanoidSprintButton",key:"Key_LeftShift"},
  {action:"HumanoidCrouchButton",key:"Key_LeftControl"},
  {action:"HumanoidJumpButton",key:"Key_Space"},
  {action:"HumanoidPrimaryInteractButton",key:"Key_E"},
  {action:"HumanoidSecondaryInteractButton",key:"Key_F"},
  {action:"HumanoidReloadButton",key:"Key_R"},
  {action:"HumanoidMeleeButton",key:"Key_V"},
  {action:"HumanoidThrowGrenadeButton",key:"Key_G"},
  {action:"HumanoidSelectPrimaryWeaponButton",key:"Key_1"},
  {action:"HumanoidSelectSecondaryWeaponButton",key:"Key_2"},
  {action:"HumanoidHideWeaponButton",key:"Key_U"},
  {action:"HumanoidToggleFlashlightButton",key:"Key_T"},
  {action:"HumanoidToggleNightVisionButton",key:"Key_N"},
  {action:"HumanoidToggleShieldsButton",key:"Key_C"},
  {action:"HumanoidSwitchToRechargeTool",key:"Key_3"},
  {action:"HumanoidSwitchToCompAnalyser",key:"Key_4"},
  {action:"HumanoidSwitchToSuitTool",key:"Key_5"},
  {action:"HumanoidItemWheelButton",key:"Key_LeftAlt"},
  {action:"HumanoidBattery",key:"Key_H"},
  {action:"HumanoidHealthPack",key:"Key_J"},
  {action:"HumanoidToggleToolModeButton",key:"Key_X"},
  {action:"HumanoidPulseScanButton",key:"Key_P"},
  {action:"HumanoidOpenAccessPanelButton",key:"Key_O"},
  {action:"HumanoidWalkButton",key:"Key_B"},
  {action:"GalaxyMapOpen_Humanoid",key:"Key_F9"},
  {action:"SystemMapOpen_Humanoid",key:"Key_F10"},
  {action:"HumanoidToggleMissionHelpPanelButton",key:"Key_F1"},
  {action:"HumanoidEmoteWheelButton",key:"Key_F2"},
  {action:"HumanoidSelectNextGrenadeTypeButton",key:"Key_F3"},
  {action:"HumanoidSelectPreviousGrenadeTypeButton",key:"Key_F4"},
  {action:"HumanoidUtilityWheelCycleMode",key:"Key_F5"},
  {action:"HumanoidSelectEMPGrenade",key:"Key_F6"},
  {action:"HumanoidSelectFragGrenade",key:"Key_F7"},
  {action:"HumanoidSelectShieldGrenade",key:"Key_F8"},
  {action:"FocusCommsPanel_Humanoid",key:"Key_F11"},
  {action:"QuickCommsPanel_Humanoid",key:"Key_F12"},
];
export interface FootFullPlan extends PreparedPlan {
  unassigned:readonly string[];
  totalDigital:number;
  expected:readonly KeyRule[];
  namedPreset:string;
}

/** In-memory preview: choose keyboard slots only; preserve any nonkeyboard primary.
 * Never imply that all 79 on-foot XML actions can be assigned digital keys:
 * this includes analog axes and emote actions, which are reported separately.
 */
export function planCompleteFoot(
  usage:Usage,actions:readonly string[],original:readonly Bind[],meta:BindsMeta,
):FootFullPlan {
  const sourceActions=new Set(actions),wanted=new Set<string>();
  const rules=FOOT_ESSENTIAL_RULES;
  const template:PreparedTemplate={
    scope:"foot",usage,label:"À pied · "+(usage==="balanced"?"AZERTY complet":
      usage==="navigation"?"navigation":usage==="combat"?"combat":"exploration"),
    description:"ZQSD et équipement complet ; touches proposées puis vérifiées avant création du .binds.",
    rules,
  };
  const skipped:PreparedSkip[]=[];let covered=0,available=0;
  const proposals:PresetAssignment[]=[];
  for(const rule of rules){
    if(!sourceActions.has(rule.action)||scopeForGroup(groupOf(meta,rule.action))!=="foot"){
      skipped.push({...rule,reason:"Commande non déclarée dans le fichier source."});continue;
    }
    if(!approvedCapturedKeyboardKey("Keyboard",rule.key,[])){
      skipped.push({...rule,reason:"Touche non autorisée par le moteur Odyssey."});continue;
    }
    available++;
    if(wanted.has(rule.key)){
      skipped.push({...rule,reason:"Touche déjà réservée à une autre suggestion."});continue;
    }
    wanted.add(rule.key);
    const active=original.filter(b=>b.action===rule.action&&b.slot!=="axis");
    if(active.some(b=>b.device==="Keyboard"&&b.key===rule.key&&!b.modifiers.length)){covered++;continue;}
    const primary=active.find(b=>b.slot==="primary");
    const secondary=active.find(b=>b.slot==="secondary");
    const slot=primary?.device==="Keyboard"?"primary":
      secondary?.device==="Keyboard"?"secondary":
      !primary?"primary":!secondary?"secondary":null;
    if(!slot){skipped.push({...rule,reason:"Deux affectations non clavier déjà présentes : non remplacées."});continue;}
    const old=slot==="primary"?primary:secondary;
    proposals.push({
      action:rule.action,slot,device:"Keyboard",key:rule.key,modifiers:[],
      replaceExisting:Boolean(old),
    });
  }
  let pending=proposals;
  let removed=true;
  while(removed){
    removed=false;
    const released=new Set(pending.filter(p=>p.replaceExisting).map(p=>p.action+"|"+p.slot));
    const survivors:PresetAssignment[]=[];
    for(const p of pending){
      const keyIsBusy=original.some(b=>
        scopeForGroup(groupOf(meta,b.action))==="foot"&&b.slot!=="axis"&&
        b.action!==p.action&&b.device==="Keyboard"&&b.key===p.key &&
        !released.has(b.action+"|"+b.slot));
      const duplicated=survivors.some(b=>b.key===p.key);
      if(keyIsBusy||duplicated){
        skipped.push({action:p.action,key:p.key,reason:
          keyIsBusy?"Touche encore utilisée par une autre commande À pied.":
          "Touche déjà proposée dans ce profil."});
        removed=true;
      }else survivors.push(p);
    }
    pending=survivors;
  }
  // Every on-foot digital action is accounted for, including deliberately unassigned
  // alternatives, emotes and utility controls. Analog axes are not treated as keys.
  const digital=actions.filter(a=>scopeForGroup(groupOf(meta,a))==="foot"&&
    !/Axis$|_XAxis$|_YAxis$/.test(a));
  const coveredByRule=new Set(rules.map(r=>r.action));
  const unassigned=digital.filter(a=>!coveredByRule.has(a)&&
    !original.some(b=>b.action===a&&b.slot!=="axis"));
  const warnings=[
    "Préréglage Cyberpunk Philou : propositions ergonomiques, pas des raccourcis officiels Frontier.",
    "ZQSD pour avancer, reculer, gauche et droite ; les touches W/Q héritées ne sont remplacées que si le conflit est résolu.",
    "Les axes, la souris existante, le HOTAS X52 Pro et la manette Xbox ne sont jamais remplacés automatiquement.",
    `${digital.length} commandes numériques À pied répertoriées ; ${unassigned.length} sans suggestion automatique ni touche source. Elles restent configurables avec P/S.`,
    "La liste des changements doit être vérifiée : chaque touche effectivement enregistrée est contrôlée lors de la création du nouveau profil.",
  ];
  return {template,changes:pending,covered,available,skipped,warnings,
    unassigned,totalDigital:digital.length,expected:rules,namedPreset:FOOT_NAMED_PRESET[usage]};
}

/** Check the intended ZQSD outcome, including values kept from the original profile.
 * A preset must not be advertised as AZERTY-complete if a movement rule was skipped.
 */
export function missingFootMovement(
  original:readonly Bind[],staged:readonly PresetAssignment[],
):readonly KeyRule[] {
  const moved=new Set(staged.filter(s=>s.replaceExisting).map(s=>s.action+"|"+s.slot));
  return FOOT_ESSENTIAL_RULES.slice(0,4).filter(rule=>{
    const hasNew=staged.some(s=>s.action===rule.action&&s.device==="Keyboard"&&s.key===rule.key&&!s.modifiers.length);
    const hasOld=original.some(b=>b.action===rule.action&&b.device==="Keyboard"&&
      b.key===rule.key&&!b.modifiers.length&&!moved.has(b.action+"|"+b.slot));
    return !hasNew&&!hasOld;
  });
}

/** Combine full keyboard and optional mouse suggestions without assigning a slot
 * twice. For example, secondary interact gets F (primary) and can receive Mouse_3
 * (secondary), but only if that slot is actually free in the source.
 */
export function mergeFootKeyboardMouse(
  keyboard:readonly PresetAssignment[],mouse:readonly PresetAssignment[],
  source:readonly Bind[],
):PresetAssignment[] {
  const combined=keyboard.map(k=>({...k,modifiers:[...k.modifiers]}));
  for(const item of mouse){
    let slot=item.slot;
    const used=(s:string)=>combined.some(c=>c.action===item.action&&c.slot===s)||
      source.some(c=>c.action===item.action&&c.slot===s);
    if(used(slot))slot=slot==="primary"?"secondary":"primary";
    if(used(slot))continue;
    if(combined.length>=64)break;
    combined.push({...item,slot:slot as "primary"|"secondary",replaceExisting:false});
  }
  return combined;
}
