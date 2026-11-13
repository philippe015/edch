/** Cyberpunk Philou v1.6.13 — complete virtual AZERTY (ISO) keyboard for Commands.
 * Each button inspects its real Elite .binds assignments and staged changes.
 * It does not capture keystrokes, send input to the game, or change the source.
 */
import type { Bind, BindsMeta } from "../../features/controls/binds.js";
import type { PresetAssignment } from "../../features/controls/presetAdvisor.js";
import type { GameScope } from "../../features/controls/scopedProfiles.js";
import { assignmentsForVirtualKey, keyIds, virtualKeyCount } from "../../features/controls/virtualAzerty.js";
import { localizedActionLabel, localizedKeyLabel } from "../../features/controls/actionLabels.js";
import { KEY_IDS, KEY_CAPS, type Id } from "./keyLayouts.js";
import { h } from "../../ui/dom.js";

const ids = KEY_IDS.azerty;
const caps = KEY_CAPS.azerty;
const sourceRows:readonly {name:string;keys:readonly [Id,string,number?][]}[] = [
  {name:"Fonctions",keys:[
    ["Key_Escape","Échap",1.2],
    ...Array.from({length:12},(_,i):[string,string]=>[`Key_F${i+1}`,`F${i+1}`]),
  ]},
  {name:"Chiffres",keys:[
    ...ids.num.map((id,i):[Id,string]=>[id,caps.num[i]??""]),
    ["Key_Backspace","Retour",2],
  ]},
  {name:"Lettres",keys:[
    ["Key_Tab","Tab",1.5],...ids.r1.map((id,i):[Id,string]=>[id,caps.r1[i]??""]),
  ]},
  {name:"Lettres",keys:[
    ["Key_CapsLock","Verr. Maj",1.8],
    ...ids.r2.map((id,i):[Id,string]=>[id,caps.r2[i]??""]),
    [ids.extra,caps.extra],["Key_Enter","Entrée",2],
  ]},
  {name:"Lettres",keys:[
    ["Key_LeftShift","Maj ⇧",1.8], [ids.iso,caps.iso],
    ...ids.r3.map((id,i):[Id,string]=>[id,caps.r3[i]??""]),
    ["Key_RightShift","Maj ⇧",2.1],
  ]},
  {name:"Modificateurs",keys:[
    ["Key_LeftControl","Ctrl",1.5],["Key_LeftWin","Win",1.2],["Key_LeftAlt","Alt",1.2],
    ["Key_Space","Espace",6],["Key_RightAlt","Alt Gr",1.2],
    ["Key_Apps","Menu",1.2],["Key_RightControl","Ctrl",1.5],
  ]},
];
const navigationRows:readonly [Id,string,number?][][]=[
  [["Key_PrintScreen","ImpÉcr"],["Key_ScrollLock","Arrêt Défil"],["Key_Pause","Pause"]],
  [["Key_Insert","Inser"],["Key_Home","Début"],["Key_PageUp","Page ↑"]],
  [["Key_Delete","Suppr"],["Key_End","Fin"],["Key_PageDown","Page ↓"]],
  [["Key_LeftArrow","←"],["Key_UpArrow","↑"],["Key_RightArrow","→"]],
  [["Key_DownArrow","↓"]],
];
const numpadRows:readonly [Id,string,number?][][]=[
  [["Key_NumLock","Verr Num"],["Key_Numpad_Divide","/"],["Key_Numpad_Multiply","*"],["Key_Numpad_Subtract","−"]],
  [["Key_Numpad_7","7"],["Key_Numpad_8","8"],["Key_Numpad_9","9"],["Key_Numpad_Add","+"]],
  [["Key_Numpad_4","4"],["Key_Numpad_5","5"],["Key_Numpad_6","6"]],
  [["Key_Numpad_1","1"],["Key_Numpad_2","2"],["Key_Numpad_3","3"],["Key_Numpad_Enter","Entrée"]],
  [["Key_Numpad_0","0",2],["Key_Numpad_Decimal",","]],
];

export interface VirtualKeyboardOptions {
  meta:BindsMeta;
  scope:GameScope;
  original:readonly Bind[];
  draft:readonly PresetAssignment[];
  selectedKey:string;
  sourceLoaded:boolean;
  onSelect:(key:string)=>void;
}
export function virtualAzertyKeyboard(options:VirtualKeyboardOptions):HTMLElement {
  const {meta,scope,original,draft,selectedKey,sourceLoaded,onSelect}=options;
  const summary=(key:Id)=>assignmentsForVirtualKey(key,scope,original,draft,meta);
  const button=(id:Id,label:string,w=1):HTMLElement=>{
    const keys=keyIds(id);
    const state=summary(id);
    const count=virtualKeyCount(state);
    const selected=keys.includes(selectedKey);
    const planned=state.prepared.length>0;
    const current=state.existing.length>0;
    const names=[...state.existing,...state.prepared]
      .map(x=>localizedActionLabel(meta,x.action));
    const tooltip=count
      ? `${label} : ${[...new Set(names)].join(", ")}`
      : `${label} : aucune commande assignée dans ce contexte`;
    const cls=["edch-vkb-key",current?"assigned":"",planned?"planned":"",selected?"selected":""].filter(Boolean).join(" ");
    return h("button",{
      class:cls,type:"button",style:{flexGrow:String(w),flexBasis:`${w*45}px`},
      title:tooltip, "aria-pressed":selected,
      "aria-label":`${label} : ${count} affectation(s). Cliquer pour voir les commandes.`,
      "data-key":keys[0],
      onclick:()=>onSelect(keys[0]),
    },
      h("span.edch-vkb-cap",null,label),
      count?h("span.edch-vkb-count",null,String(count)):null,
      planned?h("span.edch-vkb-dot",{title:"Modification proposée"},"•"):null,
    );
  };
  const row=(keys:readonly [Id,string,number?][])=>h("div.edch-vkb-row",null,
    ...keys.map(([id,label,w])=>button(id,label,w??1)));
  const keyPanel=selectedKey
    ?(()=>{
      const state=summary(selectedKey);
      const label=localizedKeyLabel(meta,selectedKey);
      const items=[...state.existing,...state.prepared];
      const show=(item:(typeof items)[number])=>h("div.edch-vkb-assignment",null,
        h("span", {class:item.kind==="prepared"?"edch-vkb-tag planned":"edch-vkb-tag"},
          item.kind==="prepared"?"Brouillon":"Profil actuel"),
        h("strong",null,localizedActionLabel(meta,item.action)),
        h("small",null,
          `${item.slot==="primary"?"Principale":item.slot==="secondary"?"Secondaire":"Axe"} · ${item.device} : ${item.key}`,
          item.usesModifier?" · utilisée comme modificateur":"",
          item.modifiers.length?" · "+item.modifiers.join(" + "):"",
        ),
      );
      return h("section.edch-vkb-inspector",{role:"region","aria-label":"Affectations de la touche"},
        h("h5",null,`Touche sélectionnée : ${label}`),
        !sourceLoaded?h("p",null,"Choisis un fichier .binds personnel pour afficher ses affectations."):null,
        items.length?h("div.edch-vkb-assignments",null,...items.map(show)):
          h("p",null,"Aucune commande affectée à cette touche dans le contexte sélectionné."),
      );
    })()
    :h("p.edch-vkb-hint",null,"Clique sur une touche pour afficher les commandes qui lui sont associées.");

  return h("section.edch-vkb-panel",{role:"region","aria-label":"Clavier virtuel AZERTY des commandes Elite Dangerous"},
    h("div.edch-vkb-header",null,
      h("div",null,
        h("h4",null,"Clavier virtuel AZERTY · disposition française"),
        h("p",null,"Touches visibles et cliquables. Les affectations sont lues dans le profil sélectionné et les propositions du brouillon.")),
      h("div.edch-vkb-legend",null,
        h("span.edch-vkb-legend-item",null,h("i",{class:"edch-vkb-swatch assigned"}),"Attribuée"),
        h("span.edch-vkb-legend-item",null,h("i",{class:"edch-vkb-swatch planned"}),"Proposée"),
        h("span.edch-vkb-legend-item",null,h("i",{class:"edch-vkb-swatch"}),"Libre"),
      ),
    ),
    h("div.edch-vkb-scroll",{tabIndex:0,"aria-label":"Disposition du clavier virtuel, défilement horizontal possible"},
      h("div.edch-vkb-body",null,
        h("div.edch-vkb-main",null,...sourceRows.map(r=>row(r.keys))),
        h("div.edch-vkb-side",null,
          h("strong",null,"Navigation"),
          ...navigationRows.map(row)),
        h("div.edch-vkb-pad",null,
          h("strong",null,"Pavé numérique"),
          ...numpadRows.map(row)),
      ),
    ),
    keyPanel,
    h("p.edch-vkb-footnote",null,
      "Lecture seule : cliquer ne simule pas l'appui dans Elite Dangerous et ne modifie pas les commandes. Les touches sont celles d'un clavier AZERTY ISO ; vérifie la disposition déclarée dans le fichier .binds."),
  );
}
