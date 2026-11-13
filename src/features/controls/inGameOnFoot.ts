/** EDCH v1.6.18 — safe Odyssey in-game preset guidance.
 * Reads only, never updates StartPreset or sends keys into the running game.
 */
import { parseStartPreset,presetLineFor } from "./binds.js";

export interface InGameOnFootStatus {
  activePreset:string|null;
  expectedPreset:string|null;
  status:"active"|"other"|"unknown";
  help:string;
}
export function safePresetName(value:string):string|null {
  const name=value.trim();
  return /^[A-Za-z0-9_]{1,40}$/.test(name)?name:null;
}
export function onFootPresetFromStartFile(text:string):string|null {
  const lines=parseStartPreset(text);
  const line=lines[presetLineFor("OnFoot")];
  return line?safePresetName(line):null;
}
export function inGameOnFootStatus(
  startPresetText:string|null,expectedPreset:string|null,
):InGameOnFootStatus {
  const activePreset=startPresetText===null?null:onFootPresetFromStartFile(startPresetText);
  const expected=expectedPreset?safePresetName(expectedPreset):null;
  if(!activePreset)return {
    activePreset:null,expectedPreset:expected,status:"unknown",
    help:"Préréglage À pied actif non vérifiable. Choisis le profil dans Options → Commandes → À pied puis applique-le.",
  };
  if(expected&&activePreset===expected)return {
    activePreset,expectedPreset:expected,status:"active",
    help:"Ce préréglage est indiqué comme actif dans StartPreset pour À pied. Vérifie ses touches dans le jeu.",
  };
  return {
    activePreset,expectedPreset:expected,status:"other",
    help:expected
      ?`Le jeu indique « ${activePreset} » pour À pied, et non « ${expected} ». Sélectionne « ${expected} » dans le jeu et applique.`
      :`Le jeu indique « ${activePreset} » comme préréglage À pied. Tu peux modifier ses touches directement dans Options → Commandes → À pied.`,
  };
}
/** On-foot is an independent Odyssey controls category; other three remain unchanged
 * if the user selects a different preset only in the On Foot drop-down.
 */
export const ON_FOOT_IN_GAME_STEPS=Object.freeze([
  "Ferme Elite Dangerous avant de créer un nouveau fichier .binds dans Cyberpunk Philou.",
  "Crée le nouveau profil et conserve son nom EDCHPro dans Cyberpunk Philou.",
  "Démarre Elite Dangerous: Odyssey. Ouvre Options → Commandes → À pied.",
  "Dans Préréglages (Presets), choisis le profil EDCHPro indiqué, puis clique sur Appliquer.",
  "Sélectionne une commande à pied dans le jeu, appuie sur la touche ou le bouton voulu, puis valide.",
  "Enregistre dans le jeu. Si le préréglage devient « Custom », c'est normal : sélectionne ce profil dans Cyberpunk Philou après actualisation.",
] as const);
