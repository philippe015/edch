/** EDCH Cyberpunk Philou v1.6.21 — stable, readable Odyssey preset names.
 * Name in filename == Root PresetName; no numerical generations per save.
 */
import type {GameScope,InputFamily,Usage} from "./scopedProfiles.js";
const MODE:Record<GameScope,string>={ship:"VAISSEAU",srv:"SRV",foot:"PIED"};
const DEVICE:Record<InputFamily,string>={azerty:"AZERTY",hotas:"X52",xbox:"XBOX"};
const STYLE:Record<Usage,string>={balanced:"POLY",navigation:"NAV",combat:"COMBAT",exploration:"EXPLORATION"};
export function namedPreset(scope:GameScope,family:InputFamily,usage:Usage):string {
  return `EDCH_${MODE[scope]}_${DEVICE[family]}_${STYLE[usage]}`;
}
export function safeEdchPresetName(name:string):boolean {
  return /^EDCH_[A-Z0-9_]{1,35}$/.test(name)&&name.length<=40;
}
export function matchedPresetFiles(name:string,files:readonly string[]):string[] {
  if(!safeEdchPresetName(name))return [];
  return files.filter(f=>f.toUpperCase().startsWith(name+".4.")&&
    /^EDCH_[A-Z0-9_]+[.]4[.][0-9]+[.]binds$/i.test(f));
}
export function presetNameHint(scope:GameScope,family:InputFamily,usage:Usage):string {
  return namedPreset(scope,family,usage).replace(/_/g," · ");
}
