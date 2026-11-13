/** Cyberpunk Philou v1.6.14 — accessible Xbox gamepad diagram for Elite .binds.
 * Vector outline + HTML buttons so every mapped control can be inspected by keyboard or mouse.
 * All controller data are read-only; this never sends presses or opens the game.
 */
import type { Bind, BindsMeta } from "../../features/controls/binds.js";
import type { PresetAssignment } from "../../features/controls/presetAdvisor.js";
import type { GameScope } from "../../features/controls/scopedProfiles.js";
import {
  XBOX_CONTROLS, xboxAssignments, xboxUnrecognized,
  isXboxDevice, type XboxDisplayedAssignment,
} from "../../features/controls/xboxIntelligentProfiles.js";
import { scopeForGroup } from "../../features/controls/scopedProfiles.js";
import { groupOf } from "../../features/controls/binds.js";
import { localizedActionLabel } from "../../features/controls/actionLabels.js";
import { h } from "../../ui/dom.js";

const NS="http://www.w3.org/2000/svg";
const el=(name:string,attrs:Record<string,string|number>):SVGElement=>{
  const node=document.createElementNS(NS,name);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
  return node;
};
function xboxOutline():SVGSVGElement {
  const svg=el("svg",{viewBox:"0 0 760 380",class:"edch-xbox-outline",
    role:"img","aria-label":"Silhouette de manette Xbox, vues des touches et des sticks"}) as SVGSVGElement;
  svg.append(
    el("path",{class:"edch-xbox-shell",
      d:"M210 95 Q380 70 550 95 Q640 105 670 190 L700 300 Q712 352 660 360 Q615 366 585 320 L545 270 Q380 262 215 270 L175 320 Q145 366 100 360 Q48 352 60 300 L90 190 Q120 105 210 95 Z"}),
    el("rect",{class:"edch-xbox-part",x:165,y:26,width:70,height:26,rx:9}),
    el("rect",{class:"edch-xbox-part",x:525,y:26,width:70,height:26,rx:9}),
    el("rect",{class:"edch-xbox-part",x:160,y:72,width:80,height:19,rx:8}),
    el("rect",{class:"edch-xbox-part",x:520,y:72,width:80,height:19,rx:8}),
    el("circle",{class:"edch-xbox-stick",cx:228,cy:164,r:37}),
    el("circle",{class:"edch-xbox-stick",cx:456,cy:247,r:37}),
    el("path",{class:"edch-xbox-part",d:"M286 206 h28 v30 h30 v28 h-30 v30 h-28 v-30 h-30 v-28 h30 Z"}),
    ...[[540,141],[495,179],[585,179],[540,217]].map(([cx,cy])=>el("circle",{class:"edch-xbox-part",cx,cy,r:18})),
    el("circle",{class:"edch-xbox-part",cx:380,cy:110,r:16}),
    el("rect",{class:"edch-xbox-part",x:320,y:139,width:31,height:20,rx:7}),
    el("rect",{class:"edch-xbox-part",x:408,y:139,width:31,height:20,rx:7}),
  );
  return svg;
}
const action=(meta:BindsMeta,b:XboxDisplayedAssignment):string=>localizedActionLabel(meta,b.action);
const inspectRow=(meta:BindsMeta,b:XboxDisplayedAssignment):HTMLElement=>
  h("div.edch-xbox-detail-row",null,
    h("span",{class:b.status==="draft"?"edch-xbox-tag planned":"edch-xbox-tag"},
      b.status==="draft"?"Brouillon":"Profil actuel"),
    h("strong",null,action(meta,b)),
    h("small",null,
      (b.slot==="axis"?"Axe analogique":b.slot==="primary"?"Principale":"Secondaire")+
      " · "+b.device+" / "+b.key+
      (b.modifiers.length?" · "+b.modifiers.join(" + "):"")+
      (b.inverted?" · axe inversé":"")+
      (b.isModifier?" · bouton modificateur":""),
    ),
  );
export interface XboxDiagramOptions {
  meta:BindsMeta; scope:GameScope;
  sourceLoaded:boolean;original:readonly Bind[];draft:readonly PresetAssignment[];
  selected:string;onSelect:(control:string)=>void;
}
export function xboxControllerDiagram(options:XboxDiagramOptions):HTMLElement {
  const {meta,scope,original,draft,selected,onSelect,sourceLoaded}=options;
  const detected=[...new Set(original.filter(b=>isXboxDevice(b.device,meta)).map(b=>b.device))];
  const overview=(id:string)=>xboxAssignments(id,scope,original,draft,meta);
  const selectedButton=XBOX_CONTROLS.find(c=>c.id===selected);
  const assignmentRows=selectedButton?overview(selectedButton.id):{existing:[],draft:[]};
  const all=[...assignmentRows.existing,...assignmentRows.draft];
  const unknown=xboxUnrecognized(original.filter(b=>scopeForGroup(groupOf(meta,b.action))===scope),meta);
  const controls=h("div.edch-xbox-stage",null,xboxOutline(),
    ...XBOX_CONTROLS.map(c=>{
      const state=overview(c.id);
      const amount=state.existing.length+state.draft.length;
      const planned=state.draft.length>0;
      const bound=state.existing.length>0;
      const focus=selected===c.id;
      const title=amount
        ?c.label+" : "+[...new Set([...state.existing,...state.draft].map(b=>action(meta,b)))].join(" / ")
        :c.label+" : aucune affectation reconnue dans ce contexte";
      return h("button",{
        type:"button",
        class:["edch-xbox-control",c.kind,bound?"assigned":"",planned?"planned":"",focus?"selected":""]
          .filter(Boolean).join(" "),
        title,"aria-label":title,"aria-pressed":focus,"data-xbox-control":c.id,
        style:{left:c.x+"%",top:c.y+"%"},
        onclick:()=>onSelect(c.id),
      },
        h("span.edch-xbox-label",null,c.label),
        amount?h("span.edch-xbox-count",null,String(amount)):null,
      );
    }),
  );
  const details=h("section.edch-xbox-inspector",{"aria-label":"Détails des commandes de la manette",role:"region"},
    h("h5",null,selectedButton?"Bouton sélectionné : "+selectedButton.label:"Sélectionne un bouton ou un axe"),
    !sourceLoaded?h("p.edch-c166-muted",null,
      "Choisis un fichier .binds personnel. Les boutons seront identifiés à partir des affectations qu'il contient.") : null,
    all.length?h("div.edch-xbox-detail-list",null,...all.map(b=>inspectRow(meta,b))):
      h("p.edch-c166-muted",null,
        selectedButton?"Aucune affectation connue pour ce contrôle dans le contexte affiché.":
        "Clique sur A, B, X, Y, un stick ou une gâchette pour afficher ses fonctions."),
    selectedButton&&all.some(b=>b.slot==="axis")?
      h("p.edch-c166-muted",null,"L'axe analogique est affiché pour information et n'est jamais réécrit par les profils intelligents.") : null,
  );
  return h("section.edch-xbox-panel",{role:"region","aria-label":"Schéma Xbox et commandes Elite Dangerous"},
    h("div.edch-xbox-head",null,
      h("div",null,h("h4",null,"Manette Xbox · graphique interactif"),
        h("p",null,"Les commandes proviennent du fichier .binds réellement sélectionné. Appuie sur un bouton du dessin pour afficher ses affectations.")),
      h("div.edch-xbox-legend",null,
        h("span",null,h("i.edch-xbox-dot.assigned"),"Attribué"),
        h("span",null,h("i.edch-xbox-dot.planned"),"Proposé"),
        h("span",null,h("i.edch-xbox-dot"),"Non reconnu"),
      ),
    ),
    detected.length?h("p.edch-xbox-devices",null,"Contrôleur(s) dans le profil : "+detected.join(" · ")) :
      h("p.edch-c166-muted",null,"Aucune manette Xbox détectée dans ce profil. Le dessin est indicatif, sans correspondance inventée."),
    h("div.edch-xbox-scroll",{tabIndex:0,"aria-label":"Manette Xbox, défilement horizontal possible"},
      controls),
    details,
    unknown.length?h("details.edch-xbox-unknown",null,
      h("summary",null,unknown.length+" entrée(s) de manette non identifiée(s) dans le schéma"),
      h("p",null,"Codes bruts du jeu conservés sans supposer leur position physique."),
      ...unknown.slice(0,24).map(b=>h("div",null,
        h("strong",null,localizedActionLabel(meta,b.action)),
        " · "+b.device+" / "+b.key+" ("+b.slot+")")),
    ):null,
    h("p.edch-xbox-foot",null,
      "Lecture seule : aucun appui n'est envoyé au jeu. Les axes et les boutons non reconnus ne sont pas convertis en numéros supposés. Les propositions apparaissent en orange avant validation."),
  );
}
