/** Odyssey Energy Link aid for EDCH. Uses the real XML action rather than inventing
 * a keyboard or device mapping; only an explicit, reviewed new .binds profile is writable.
 */
import {type Bind,type BindsMeta,groupOf} from "./binds.js";
import type {PresetAssignment} from "./presetAdvisor.js";
import {scopeForGroup} from "./scopedProfiles.js";

export const ENERGY_LINK_ACTION="HumanoidSwitchToRechargeTool";
export const ENERGY_LINK_DEFAULT_KEY="Key_3";
export const ENERGY_LINK_RELATED=Object.freeze([
  {action:"HumanoidSwitchToRechargeTool",label:"Sortir l'outil Energy Link",help:"Par défaut : touche 3"},
  {action:"HumanoidPrimaryFireButton",label:"Activer le transfert",help:"Maintenir le tir principal sur la prise verte"},
  {action:"HumanoidToggleToolModeButton",label:"Changer le mode de l'outil",help:"Garder le mode transfert pour recharger la combinaison"},
  {action:"HumanoidBattery",label:"Utiliser une cellule d'énergie",help:"Recharge par consommable : différente de la borne"},
] as const);

export interface EnergyLinkPlan {
  available:boolean;
  assigned:Bind[];
  suggestion:PresetAssignment|null;
  reason:string;
}
export function planEnergyLink(
  actions:readonly string[],binds:readonly Bind[],meta:BindsMeta,
):EnergyLinkPlan {
  const available=actions.includes(ENERGY_LINK_ACTION)&&
    scopeForGroup(groupOf(meta,ENERGY_LINK_ACTION))==="foot";
  const assigned=binds.filter(b=>b.action===ENERGY_LINK_ACTION&&b.slot!=="axis");
  if(!available)return {available:false,assigned,suggestion:null,
    reason:"La commande Energy Link n'est pas déclarée dans le fichier .binds sélectionné."};
  if(assigned.some(b=>b.device==="Keyboard"&&b.key===ENERGY_LINK_DEFAULT_KEY&&!b.modifiers.length))
    return {available,assigned,suggestion:null,reason:"La touche 3 est déjà affectée à l'outil Energy Link."};
  if(assigned.some(b=>b.device==="Keyboard"))
    return {available,assigned,suggestion:null,reason:"Une touche de clavier est déjà configurée : vérifie son nom ci-dessous. Aucun remplacement automatique."};
  const busy=binds.some(b=>scopeForGroup(groupOf(meta,b.action))==="foot" &&
    b.action!==ENERGY_LINK_ACTION && b.slot!=="axis" &&
    ((b.device==="Keyboard"&&b.key===ENERGY_LINK_DEFAULT_KEY)||
      b.modifiers.some(m=>m.device==="Keyboard"&&m.key===ENERGY_LINK_DEFAULT_KEY)));
  if(busy)return {available,assigned,suggestion:null,
    reason:"La touche 3 est déjà utilisée à pied : aucune modification automatique."};
  const primary=assigned.some(b=>b.slot==="primary");
  const secondary=assigned.some(b=>b.slot==="secondary");
  const slot=primary?secondary?null:"secondary":"primary";
  if(!slot)return {available,assigned,suggestion:null,
    reason:"Les emplacements principale et secondaire sont occupés : configure manuellement la touche voulue."};
  return {available,assigned,suggestion:{
    action:ENERGY_LINK_ACTION,slot,device:"Keyboard",key:ENERGY_LINK_DEFAULT_KEY,
    modifiers:[],replaceExisting:false,
  },reason:"La touche 3 est disponible : proposition à vérifier avant de créer un nouveau profil."};
}
