/** On-foot mouse visualization next to the AZERTY keyboard.
 * Buttons are for inspection, not live game input. Stage only known digital Mouse_1.. inputs.
 */
import type {Bind,BindsMeta} from "../../features/controls/binds.js";
import type {PresetAssignment} from "../../features/controls/presetAdvisor.js";
import {
  FOOT_MOUSE_CONTROLS, mouseAssignments, digitalMouseInputs, mouseControlMatches,
  type MouseVisualAssignment,
} from "../../features/controls/virtualFootMouse.js";
import {localizedActionLabel} from "../../features/controls/actionLabels.js";
import {h} from "../../ui/dom.js";

export interface MousePanelOptions {
  meta:BindsMeta;
  sourceLoaded:boolean;
  original:readonly Bind[];
  draft:readonly PresetAssignment[];
  selected:string;
  onSelect:(id:string)=>void;
}
export function virtualFootMouse(options:MousePanelOptions):HTMLElement {
  const {meta,sourceLoaded,original,draft,selected,onSelect}=options;
  const recognized=digitalMouseInputs(original);
  const panelButton=(id:string)=>{
    const def=FOOT_MOUSE_CONTROLS.find(c=>c.id===id)!;
    const summary=mouseAssignments(id,original,draft,meta);
    const all=[...summary.existing,...summary.draft];
    const assigned=summary.existing.length>0,planned=summary.draft.length>0;
    const names=[...new Set(all.map(a=>localizedActionLabel(meta,a.action)))];
    const title=all.length?def.detail+" : "+names.join(" ; "):
      def.detail+" : aucune commande à pied reconnue";
    return h("button",{
      type:"button",class:["edch-mouse-btn",def.kind,assigned?"assigned":"",planned?"planned":"",selected===id?"selected":""].filter(Boolean).join(" "),
      title,"aria-pressed":selected===id,"aria-label":title,"data-mouse-control":id,
      onclick:()=>onSelect(id),
    },
      h("strong",null,def.label),
      all.length?h("span.edch-mouse-count",null,String(all.length)):null,
      all.length?h("small.edch-mouse-short",null,names[0]):null,
    );
  };
  const items=selected?mouseAssignments(selected,original,draft,meta):{existing:[],draft:[]};
  const details=[...items.existing,...items.draft];
  const detailRow=(b:MouseVisualAssignment)=>h("div.edch-mouse-detail-row",null,
    h("span",{class:b.kind==="draft"?"edch-mouse-tag planned":"edch-mouse-tag"},
      b.kind==="draft"?"Brouillon":"Profil actuel"),
    h("strong",null,localizedActionLabel(meta,b.action)),
    h("small",null,(b.slot==="axis"?"Axe analogique":b.slot==="primary"?"Principale":"Secondaire")+
      " · "+b.device+" / "+b.key+
      (b.modifiers.length?" + "+b.modifiers.join(" + "):"")+
      (b.isModifier?" · modificateur":"")),
  );
  const unknown=original.filter(b=>b.device==="Mouse" &&
    !FOOT_MOUSE_CONTROLS.some(c=>mouseControlMatches(c.id,b.device,b.key)));
  return h("section.edch-mouse-panel",{role:"region","aria-label":"Souris virtuelle pour les commandes à pied"},
    h("div.edch-mouse-header",null,
      h("h4",null,"Souris · commandes à pied"),
      h("p",null,"Clic gauche/droit, molette, boutons latéraux et axes X/Y, d'après le profil sélectionné.")),
    h("div.edch-mouse-layout",null,
      h("div.edch-mouse-shape",{"aria-label":"Schéma interactif de souris"},
        h("div.edch-mouse-top",null,panelButton("Mouse_1"),panelButton("Mouse_3"),panelButton("Mouse_2")),
        h("div.edch-mouse-middle",null,
          h("div.edch-mouse-side",null,panelButton("Mouse_4"),panelButton("Mouse_5")),
          h("div.edch-mouse-wheel",null,panelButton("Pos_Mouse_ZAxis"),panelButton("Neg_Mouse_ZAxis")),
        ),
        h("div.edch-mouse-axes",null,panelButton("Mouse_XAxis"),panelButton("Mouse_YAxis")),
      ),
      h("section.edch-mouse-inspector",{role:"region","aria-label":"Affectations de la souris"},
        h("h5",null,selected
          ?"Élément sélectionné : "+(FOOT_MOUSE_CONTROLS.find(c=>c.id===selected)?.detail??selected)
          :"Sélectionne un bouton de souris"),
        !sourceLoaded?h("p",null,"Choisis un fichier .binds personnel pour afficher les commandes réelles.") : null,
        details.length?h("div.edch-mouse-details",null,...details.map(detailRow)):
          h("p",null,selected
            ?"Aucune commande à pied affectée à cet élément dans le profil sélectionné."
            :"Clique sur un bouton ou sur la molette pour voir ses commandes."),
        selected&&/^(Mouse_[1-9]\d*)$/.test(selected)
          ?h("p.edch-mouse-note",null,
            recognized.some(b=>b.key===selected)
              ?"Ce bouton est reconnu dans le fichier .binds et peut être choisi dans Modifier une attribution."
              :"Ce bouton n'est pas enregistré dans le .binds : aucune affectation n'est inventée.")
          :null,
      ),
    ),
    unknown.length?h("details.edch-mouse-unknown",null,
      h("summary",null,unknown.length+" code(s) de souris hors schéma"),
      ...unknown.slice(0,15).map(x=>h("p",null,x.action+" : "+x.key)),
    ):null,
    h("p.edch-mouse-note",null,"Lecture seule : aucun clic n'est envoyé au jeu. Les axes restent inchangés ; seules les entrées réellement présentes dans le profil peuvent être utilisées pour un nouveau brouillon."),
  );
}
