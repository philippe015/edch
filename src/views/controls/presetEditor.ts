/** EDCH v1.6.6 — Elite-style controls workbench with explicit review-before-save.
 * No live game input, local ML, network data, hidden profile changes or fabricated device buttons.
 */
import { type BindsMeta, type Bind, parseBinds, parseXml, fileForPreset, groupOf } from "../../features/controls/binds.js";
import { localizedActionLabel} from "../../features/controls/actionLabels.js";
import { controlsSaveNamedPresetBatch, isRemote, isTauri, readOptionFile, listOptionFiles, optionsDir, revealPath, type OptionFile } from "../../platform/bridge.js";
import {
  bindingKey, catalogRows, inputCatalog, isStagedAssignmentValid, occupancyWarnings,
  type PresetAssignment, type SuggestedProfile,
} from "../../features/controls/presetAdvisor.js";
import { h } from "../../ui/dom.js";
import {
  detectedInputs, GAME_SCOPES, INPUT_FAMILIES, recommendScopedProfile, scopedInputWarnings, USAGE_STYLES,
  type GameScope, type InputFamily,
} from "../../features/controls/scopedProfiles.js";
import { GAME_SECTIONS, PREPARED_TEMPLATES, prepareAzerty, sectionForAction } from "../../features/controls/preparedProfiles.js";
import { HotasStudio } from "./hotasStudio.js"; // EDCH-HOTAS-STUDIO-v1.6.7
import { X52ModesPanel } from "./x52ModesPanel.js"; // EDCH-X52-MODES-v1.6.8
import { virtualAzertyKeyboard } from "./virtualAzertyKeyboard.js";
import { virtualFootMouse } from "./virtualFootMouse.js";
import {ENERGY_LINK_RELATED,planEnergyLink} from "../../features/controls/energyLink.js";
import { ON_FOOT_IN_GAME_STEPS, inGameOnFootStatus, onFootPresetFromStartFile, type InGameOnFootStatus } from "../../features/controls/inGameOnFoot.js";
import { digitalMouseInputs, recommendFootMouse } from "../../features/controls/virtualFootMouse.js";
import { namedPreset, matchedPresetFiles, safeEdchPresetName } from "../../features/controls/namedPresets.js";
import { prepareCompleteFootAzerty } from "../../features/controls/completeFootPresets.js";
import { captureKeyboardForFoot, captureMouseForFoot, captureVirtualFootKey, type CapturedDigitalInput } from "../../features/controls/footDirectCapture.js";
import { xboxControllerDiagram } from "./xboxControllerDiagram.js";
import { isXboxDevice, xboxControl, recommendXboxProfile, XBOX_STYLES } from "../../features/controls/xboxIntelligentProfiles.js";

interface SourceState { filename: string; preset: string; actions: string[]; binds: Bind[]; keyboardLayout: string }
const ACCEPTED = /^[A-Za-z0-9_]{1,100}$/;
// Trois contextes principaux : l'interface et les cartes sont dans les outils avancés.
export function actionsFromXml(xml: string): string[] {
  const root=parseXml(xml).children.find(node=>node.tag==="Root");
  if (!root) return [];
  return root.children.filter(node=>ACCEPTED.test(node.tag) && node.children.some(child=>child.tag==="Primary"||child.tag==="Secondary"))
    .map(node=>node.tag).sort((a,b)=>a.localeCompare(b,"fr"));
}
const labelSlot=(slot: "primary"|"secondary")=>slot==="primary"?"Principale":"Secondaire";
const readKey=(entry?:Bind)=>entry?`${entry.device} : ${entry.key}${entry.modifiers.length?" + "+entry.modifiers.map(m=>m.key).join(" + "):""}`:"Non attribuée";

export class ControlsPresetEditor {
  private selected="";
  private source?:SourceState;
  private attempted="";
  private generation=0;
  private loading=false;
  private saving=false;
  private message="";
  private mode:GameScope="ship";
  private family:InputFamily="azerty";
  private query="";
  private section="all";
  private inspectedKey="";
  private inspectedXbox="";
  private inspectedMouse="";
  private captureMode=false;
  private captureStatus="";
  private lastCreated?:{preset:string;filename:string;path:string};
  private inGameStatus:InGameOnFootStatus|null=null;
  private inGameGuideMessage="";
  private inGameGuideBusy=false;
  private profile:SuggestedProfile="balanced";
  private customPresetName="";
  private confirmNamedUpdate=false;
  private editAction="";
  private editSlot:"primary"|"secondary"="secondary";
  private editInput="";
  private replace=false;
  private staged:PresetAssignment[]=[];
  private acknowledgeWarnings=false;
  private hotasStudio = new HotasStudio();
  private x52Modes = new X52ModesPanel();
  private host?:HTMLElement;
  private context?:{meta:BindsMeta;files:OptionFile[];active:string;reload:()=>Promise<void>};

  hasDraft():boolean { return this.staged.length>0; }

  render(meta:BindsMeta, files:OptionFile[], active:string, reload:()=>Promise<void>, scope:GameScope=this.mode):HTMLElement {
    this.context={meta,files,active,reload};
    if(this.mode!==scope){
      this.mode=scope;this.staged=[];this.acknowledgeWarnings=false;
      this.editAction="";this.message="";this.section="all";this.captureMode=false;
      this.selected=active;this.source=undefined;this.attempted="";this.editInput="";this.inGameStatus=null;
    }
    const names=files.filter(f=>f.folder==="Bindings" && f.name.toLowerCase().endsWith(".binds") && f.size<=5_000_000)
      .map(f=>f.name).sort((a,b)=>a.localeCompare(b,"fr"));
    if (!names.includes(this.selected)) {
      this.selected=names.includes(active)?active:names[0]??"";
      this.source=undefined;this.attempted="";this.staged=[];this.editAction="";this.inGameStatus=null;this.captureMode=false;
    }
    if (this.selected && this.source?.filename!==this.selected && this.attempted!==this.selected && !this.loading) void this.loadSource(this.selected);
    const src=this.source?.filename===this.selected?this.source:undefined;
    const inputs=src ? [
      ...detectedInputs(src.binds,this.family,meta)
        .filter(b=>this.family!=="xbox" || (isXboxDevice(b.device,meta)&&xboxControl(b.device,b.key,meta)!==null)),
      ...(this.mode==="foot"&&this.family==="azerty"?digitalMouseInputs(src.binds):[]),
    ] : [];
    const footMousePlan=src&&this.mode==="foot"&&this.family==="azerty"
      ?recommendFootMouse(src.actions,src.binds,meta):undefined;
    const energyLinkPlan=this.mode==="foot"&&src
      ?planEnergyLink(src.actions,src.binds,meta):undefined;
    const completeFoot=src&&this.mode==="foot"&&this.family==="azerty"
      ?prepareCompleteFootAzerty(this.profile,src.actions,src.binds,meta):undefined;
    const targetName=this.customPresetName || namedPreset(this.mode,this.family,this.profile);
    const sameNamedFiles=matchedPresetFiles(targetName,names);
    const existingNamed=sameNamedFiles.length>0;
    const deviceAdvice=src&&this.family!=="xbox"
      ?recommendScopedProfile(this.mode,this.family,this.profile,src.actions,src.binds,meta):undefined;
    const xboxAdvice=src&&this.family==="xbox"
      ?recommendXboxProfile(this.mode,this.profile,src.actions,src.binds,meta):undefined;
    const allRows=src?catalogRows(src.actions,src.binds,meta,this.mode,this.query,a=>localizedActionLabel(meta,a)):[];
    const rows=this.section==="all" ? allRows : allRows.filter(row=>sectionForAction(this.mode,row.action,meta)===this.section);
    if (src && this.editAction && !src.actions.includes(this.editAction)) this.editAction="";
    if (!inputs.some(x=>bindingKey(x)===this.editInput))this.editInput=inputs.length?bindingKey(inputs[0]):"";
    const editsWarnings=src?[...new Set([...occupancyWarnings(src.binds,this.staged,meta),
      ...scopedInputWarnings(src.binds,this.staged,meta)])]:[];
    const canSave=Boolean(src&&this.staged.length && this.staged.length<=96&&
      this.staged.every(x=>isStagedAssignmentValid(x,src.actions,src.binds))
      && safeEdchPresetName(targetName)
      && (!existingNamed||this.confirmNamedUpdate)
      && (!editsWarnings.length || this.acknowledgeWarnings) &&
      isTauri() && !isRemote() && !this.loading && !this.saving);
    const selectedAction=src?.actions.includes(this.editAction)?this.editAction:"";
    const old=src?.binds.find(b=>b.action===selectedAction&&b.slot===this.editSlot);
    const selectedInput=inputs.find(x=>bindingKey(x)===this.editInput);
    const choose=(label:string,value:string,selected=false)=>h("option",{value,selected},label);
    const btn=(text:string,fn:()=>void,disabled=false,style="")=>h(`button.edch-c166-btn${style?"."+style:""}`,{type:"button",disabled,onclick:fn},text);
    const sourceSelect=h("label.edch-c166-source",null,"Profil Elite Dangerous",h("select",{value:this.selected,disabled:this.loading||this.saving,
      onchange:(e:Event)=>{this.generation++;this.selected=(e.target as HTMLSelectElement).value;this.source=undefined;
        this.attempted="";this.staged=[];this.editAction="";this.message="";this.inGameStatus=null;this.captureMode=false;this.repaint();},
    },...names.map(name=>choose(name,name,name===this.selected))));
    const heading=h("div.edch-c166-heading",null,
      h("div",null,h("p.edch-c166-eyebrow",null,"ELITE DANGEROUS · CONFIGURATION"),h("h3",null,"Commandes Elite Dangerous · profils nommés et AZERTY étendu v1.6.21"),
        h("p.edch-c166-muted",null,"Affectations du profil, suggestions locales et création d'un nouveau préréglage pour le jeu.")),
      h("div.edch-c166-hero-right",null,sourceSelect,h("span.edch-c166-chip",null,
        this.loading?"Lecture…":this.saving?"Enregistrement…":src?`${src.actions.length} commandes · ${src.binds.length} affectations`:"Profil non chargé")));
    const topTabs=h("div.edch-c166-tabs",{role:"tablist","aria-label":"Périphériques"},...INPUT_FAMILIES.map(x=>
      h("button",{type:"button",role:"tab","aria-selected":this.family===x.id,class:this.family===x.id?"active":"",
        onclick:()=>{
          if(this.family===x.id)return;
          if(this.staged.length&&!window.confirm("Changer de périphérique et abandonner le brouillon non enregistré ?"))return;
          this.family=x.id;this.staged=[];this.acknowledgeWarnings=false;this.editInput="";this.message="";this.captureMode=false;this.customPresetName="";this.confirmNamedUpdate=false;
          this.repaint();
        }},x.id==="azerty"&&this.mode==="foot"?"Clavier AZERTY + souris":x.label)));
    const search=h("label.edch-c166-search",null,"Rechercher",h("input",{type:"search",value:this.query,maxLength:120,
      placeholder:"Rechercher une commande française ou son identifiant…",oninput:(e:Event)=>{
        this.query=(e.target as HTMLInputElement).value;this.repaint("search");
      }}));
    const table=h("div.edch-c166-scroll",null,h("table.edch-c166-table",null,
      h("thead",null,h("tr",null,...["Commande","Principale","Secondaire","Attribuer"].map(s=>h("th",null,s)))),
      h("tbody",null,...rows.slice(0,200).map(row=>{
        const button=(slot:"primary"|"secondary")=>btn(slot==="primary"?"P":"S",()=>{
          this.editAction=row.action;this.editSlot=slot;this.replace=false;this.message="";
           this.captureMode=Boolean(src)&&this.mode==="foot"&&this.family==="azerty";
           this.captureStatus="";
           this.repaint(this.captureMode?"capture":undefined);
        },false, this.editAction===row.action&&this.editSlot===slot?"selected":"");
        const value=(b?:Bind)=>h("span",{class:b?"edch-c166-bound":"edch-c166-unbound"},b?readKey(b):"— Libre —");
        return h("tr",{class:this.editAction===row.action?"edch-c166-current":""},
          h("td",null,h("strong",null,localizedActionLabel(meta,row.action)),h("small",null,row.action)),
          h("td",null,value(row.primary)),h("td",null,value(row.secondary)),h("td",null,button("primary")," ",button("secondary")));
      })),
    ),
    rows.length>200?h("p.edch-c166-muted",null,`200 sur ${rows.length} commandes affichées : affine la recherche.`):null,
    !rows.length?h("p.edch-c166-muted",null,"Aucune commande pour cette recherche."):null);
    const sectionTabs=h("div.edch-c1612-sections",{role:"group","aria-label":"Catégories des commandes Elite Dangerous"},
      h("button",{type:"button",class:this.section==="all"?"active":"",
        onclick:()=>{this.section="all";this.repaint();}},`Toutes · ${allRows.length}`),
      ...GAME_SECTIONS[this.mode].map(category=>{
        const count=allRows.filter(row=>sectionForAction(this.mode,row.action,meta)===category.id).length;
        return h("button",{type:"button",class:this.section===category.id?"active":"",
          "aria-pressed":this.section===category.id,
          onclick:()=>{this.section=category.id;this.repaint();}},
          `${category.label} · ${count}`);
      }));
    const currentContext=GAME_SCOPES.find(x=>x.id===this.mode)!;
    const rowPane=h("section.edch-c166-pane.edch-c166-list",null,
      h("div.edch-c166-section-title",null,h("h4",null,currentContext.label),
        h("span",null,`${rows.length} commande(s)`)),
      h("p.edch-c166-muted",null,currentContext.description),
      h("h4",null,"Choisir le périphérique"),topTabs,
      h("p.edch-c166-muted",null,`${inputs.length} entrée(s) reconnue(s) dans le fichier source${this.mode==="foot"&&this.family==="azerty"?" (clavier et boutons de souris)":""}.`),
      sectionTabs,search,table);
    const chooseInput=h("select",{value:this.editInput,disabled:this.saving||!src,
      onchange:(e:Event)=>{this.editInput=(e.target as HTMLSelectElement).value;this.repaint();}},...inputs.map(i=>choose(readKey(i),bindingKey(i),this.editInput===bindingKey(i))));
    const editBox=h("section.edch-c166-pane",null,
      h("h4",null,"Modifier une attribution"),
      selectedAction ? h("div",null,
        h("p.edch-c166-keyname",null,localizedActionLabel(meta,selectedAction)),
        h("p.edch-c166-muted",null,`${labelSlot(this.editSlot)} · actuelle : ${readKey(old)}`),
        h("label.edch-c166-field",null,`Bouton reconnu — ${this.mode==="foot"&&this.family==="azerty"?"Clavier AZERTY + souris":INPUT_FAMILIES.find(x=>x.id===this.family)!.label}`,chooseInput),
        old?h("label.edch-c166-ack",null,h("input",{type:"checkbox",checked:this.replace,onchange:(e:Event)=>{
          this.replace=(e.target as HTMLInputElement).checked;this.repaint();}})," Remplacer cet emplacement dans le nouveau profil"):null,
        btn("Ajouter au brouillon",()=>this.stageSingle(meta),!selectedInput||(Boolean(old)&&!this.replace)||this.loading||this.saving,"primary"),
        this.mode==="foot"&&this.family==="azerty"
          ?btn("Appuyer sur une touche (clavier / souris)",()=>{
            this.captureMode=true;this.captureStatus="";this.repaint("capture");
          },!src||this.loading||this.saving):null,
      ):h("p.edch-c166-muted",null,"Choisis P (principale) ou S (secondaire) à droite d'une commande."));
    const inGameCard=this.mode==="foot"
      ?h("section.edch-ingame-foot",{role:"region","aria-label":"Configurer les commandes à pied dans Elite Dangerous Odyssey"},
        h("div.edch-ingame-foot-header",null,
          h("h4",null,"Configurer les commandes à pied directement dans le jeu"),
          h("p.edch-c166-muted",null,
            "EDCH prépare un nouveau fichier .binds compatible Odyssey. Le choix des touches dans le jeu reste sous ton contrôle."),
        ),
        h("div.edch-ingame-foot-summary",null,
          h("strong",null,"Profil à activer : "+(this.lastCreated?.preset??src?.preset??"non chargé")),
          this.lastCreated?h("p.edch-c166-muted",null,
            "Dernier profil créé : "+this.lastCreated.filename):null,
          h("p.edch-c166-muted",null,
            this.inGameStatus?this.inGameStatus.help:
              "Le préréglage actif À pied n'a pas encore été vérifié. Le nouveau profil ne devient actif qu'après sélection dans le jeu."),
          this.inGameStatus?.activePreset
            ?h("p.edch-c166-muted",null,"Préréglage À pied détecté : "+this.inGameStatus.activePreset):null,
        ),
        h("ol.edch-ingame-foot-steps",null,
          ...ON_FOOT_IN_GAME_STEPS.map((step,i)=>h("li",null,
            h("span.edch-ingame-foot-step",null,String(i+1)),
            h("span",null,step))),
        ),
        h("div.edch-ingame-foot-buttons",null,
          btn("Ouvrir le dossier des profils .binds",()=>{void this.openBindingsFolder();},
            !isTauri()||isRemote()||this.inGameGuideBusy),
          btn("Vérifier le profil À pied actif",()=>{void this.verifyInGamePreset();},
            !isTauri()||isRemote()||this.inGameGuideBusy),
          btn("Relire les réglages faits dans le jeu",()=>{void this.refreshAfterGameChanges();},
            !isTauri()||isRemote()||this.inGameGuideBusy||this.loading),
        ),
        this.inGameGuideMessage?h("p.edch-ingame-foot-message",{role:"status"},this.inGameGuideMessage):null,
        h("p.edch-c166-muted",null,
          "Aucune modification de StartPreset, aucune saisie simulée dans le jeu. Le menu À pied peut utiliser un préréglage différent de Vaisseau et SRV."),
      ):null;
    // Ready-made profiles: keyboard templates use curated printed AZERTY keys.
    // HOTAS/Xbox recommendations only reuse buttons observed in the source .binds.
    const energyLinkCard=this.mode==="foot"
      ?h("section.edch-energylink",{role:"region","aria-label":"Recharger la combinaison à une borne Energy Link"},
        h("div.edch-energylink-head",null,
          h("h4",null,"Recharge de la combinaison · Energy Link"),
          h("p",null,"Pour sortir l'outil de transfert d'énergie : touche 3 par défaut. Sur une borne de recharge alimentée, vise la prise verte et maintiens le tir principal pour recharger la combinaison."),
        ),
        h("div.edch-energylink-related",null,
          ...ENERGY_LINK_RELATED.map(item=>{
            const present=Boolean(src?.actions.includes(item.action));
            const bound=src?.binds.filter(b=>b.action===item.action&&b.slot!=="axis")??[];
            return h("div.edch-energylink-action",null,
              h("div",null,
                h("strong",null,item.label),
                h("small",null,item.help),
                h("span.edch-energylink-current",null,
                  !src?"Profil .binds non chargé":!present?"Non déclaré dans ce profil":
                    bound.length?bound.map(readKey).join(" · "):"Aucune touche attribuée"),
              ),
              btn("Voir / configurer",()=>{
                if(!src||!present)return;
                this.query=item.action;this.section="all";this.editAction=item.action;
                const related=src.binds.filter(b=>b.action===item.action&&b.slot!=="axis");
                this.editSlot=related.some(b=>b.slot==="primary")?
                  related.some(b=>b.slot==="secondary")?"primary":"secondary":"primary";
                this.replace=false;
                this.message="Commande sélectionnée. Choisis une entrée existante ou prépare un raccourci puis valide le brouillon.";
                this.repaint();
              },!src||!present||this.loading||this.saving),
            );
          }),
        ),
        energyLinkPlan ?h("div.edch-energylink-recommend",null,
          h("p.edch-c166-muted",null,energyLinkPlan.reason),
          this.family==="azerty"&&energyLinkPlan.suggestion
            ?btn("Préparer Energy Link sur la touche 3",()=>this.stageAdvice({changes:[energyLinkPlan.suggestion!]}),
              this.loading||this.saving,"primary"):null,
        ):null,
        h("p.edch-c166-muted",null,
          "Important : changer le mode de l'outil peut activer la surcharge. Utilise le mode transfert sur une borne de recharge ; une cellule d'énergie est une commande différente."),
      ):null;
    const quickCards=h("section.edch-c1612-prepared",{role:"region","aria-label":"Profils préparés Elite Dangerous"},
      h("div.edch-c1612-prepared-head",null,
        h("h4",null,"Profils préparés · "+currentContext.label),
        h("p.edch-c166-muted",null,"Choisis un style. L'aperçu est modifiable et n'écrase jamais le profil d'origine.")),
      h("div.edch-c1612-profile-grid",null,
        ...USAGE_STYLES.map(style=>{
          const template=PREPARED_TEMPLATES.find(t=>t.scope===this.mode&&t.usage===style.id)!;
          const prepared=src&&this.family==="azerty"
            ?this.mode==="foot"
              ?prepareCompleteFootAzerty(style.id,src.actions,src.binds,meta)
              :prepareAzerty(this.mode,style.id,src.actions,src.binds,meta)
            :undefined;
          const intelligent=src&&this.family==="xbox"
            ?recommendXboxProfile(this.mode,style.id,src.actions,src.binds,meta):undefined;
          const inferred=src&&this.family==="hotas"
            ?recommendScopedProfile(this.mode,this.family,style.id,src.actions,src.binds,meta):undefined;
          // The complete on-foot planner already includes verified mouse suggestions.
          const changes=[...(prepared?.changes??intelligent?.changes??inferred?.changes??[])];
          const covered=prepared?.covered??intelligent?.covered??inferred?.covered??0;
          const skipped=prepared?.skipped.length??intelligent?.skipped.length??inferred?.absent.length??0;
          const replacements=changes.filter(c=>c.replaceExisting).length;
          const detail=this.family==="azerty"
            ?template.description+(this.mode==="foot"?" Tir et zoom souris ajoutés uniquement si les boutons sont reconnus.":"")
            :this.family==="xbox"
              ?XBOX_STYLES[style.id].description+" Analyse des boutons reconnus, sans écraser les axes."
              :"Utilise les boutons déjà présents dans le profil X52 Pro / HOTAS. Aucun bouton inventé.";
          const selected=style.id===this.profile;
          return h("article.edch-c1612-profile",{class:selected?"active":""},
            h("div.edch-c1612-profile-title",null,h("strong",null,this.family==="azerty"?template.label:`${style.label} · ${this.family==="hotas"?"HOTAS X52 Pro":"Xbox"}`),
              selected?h("span",null,"Sélectionné"):null),
            h("p",null,detail),
            h("p.edch-c1612-preview",null,
              src?`${covered} déjà conforme(s) · ${changes.length} proposition(s), dont ${replacements} remplacement(s) · ${skipped} ignorée(s)`:
                "Sélectionne un .binds personnel pour voir les affectations."),
            h("button",{type:"button",disabled:!src||this.saving||this.loading,
              onclick:()=>{
                this.profile=style.id;
                this.customPresetName="";this.confirmNamedUpdate=false;
                if(changes.length)this.stageAdvice({changes});
                else{
                  this.message=this.family==="azerty"
                    ?"Ce profil est déjà conforme ou les touches proposées sont occupées. Aucune modification appliquée."
                    :"Aucun bouton vérifié ne peut être proposé pour ce périphérique. Configure-le d'abord dans Elite Dangerous.";
                  this.repaint();
                }
              }},`Préparer · ${style.label}`));
        }),
      ),
      this.family==="azerty"
        ?h("p.edch-c166-muted",null,"Profils suggérés (non officiels). À pied : souris 1 = tir, souris 2 = zoom, souris 3 = interaction secondaire seulement si ces boutons existent dans le .binds et sont libres. Vérifie le brouillon.")
        :h("p.edch-c166-muted",null,"X52 Pro/Xbox : les axes restent inchangés. Seules les affectations réellement reconnues dans le profil source peuvent être reprises."),
    );
    const adviceBox=h("section.edch-c166-pane",null,
      h("h4",null,"Profils intelligents · "+INPUT_FAMILIES.find(x=>x.id===this.family)!.label),
      h("p.edch-c166-muted",null,"Suggestions locales et vérifiables pour "+currentContext.label+". Aucun numéro HOTAS ou Xbox n'est inventé."),
      h("label.edch-c166-field",null,"Profil conseillé",h("select",{value:this.profile,disabled:this.loading||this.saving,
        onchange:(e:Event)=>{this.profile=(e.target as HTMLSelectElement).value as SuggestedProfile;this.customPresetName="";this.confirmNamedUpdate=false;this.repaint();}},
        ...USAGE_STYLES.map(x=>choose(x.label,x.id,x.id===this.profile)))),
      (this.family==="xbox"?xboxAdvice:deviceAdvice)?h("p",null,
        this.family==="xbox"
          ?`${xboxAdvice!.covered}/${xboxAdvice!.relevant} commande(s) déjà configurée(s) · ${xboxAdvice!.changes.length} proposition(s) argumentée(s).`
          :`${deviceAdvice!.covered}/${deviceAdvice!.relevant} commande(s) déjà configurée(s) · ${deviceAdvice!.changes.length} proposition(s).`):null,
      this.family==="xbox"&&xboxAdvice?.skipped.length
        ?h("details.edch-xbox-plan-skips",null,h("summary",null,
          `${xboxAdvice.skipped.length} action(s) ignorée(s) ou bloquée(s)`),
          ...xboxAdvice.skipped.slice(0,20).map(x=>h("p.edch-c166-muted",null,x))):null,
      this.family==="xbox"&&xboxAdvice?.suggestions.length
        ?h("details.edch-xbox-plan-reasons",null,h("summary",null,
          `${xboxAdvice.suggestions.length} suggestion(s) expliquée(s)`),
          ...xboxAdvice.suggestions.map(item=>h("p.edch-c166-muted",null,
            `${localizedActionLabel(meta,item.assignment.action)} → ${item.assignment.device} / ${item.assignment.key} : ${item.reason}`))):null,
      ...(this.family==="xbox"?xboxAdvice?.warnings??[]:deviceAdvice?.warnings??[])
        .map(w=>h("p.edch-c166-muted",null,w)),
      btn("Préparer les suggestions",()=>this.stageAdvice(this.family==="xbox"?xboxAdvice:completeFoot??deviceAdvice),
        !(this.family==="xbox"?xboxAdvice:completeFoot??deviceAdvice)?.changes.length||this.loading||this.saving,"primary"),
      this.mode==="foot"&&this.family==="azerty"&&footMousePlan?
        h("div.edch-foot-mouse-prepare",null,
          h("h5",null,"Souris à pied · raccourcis sûrs"),
          h("p.edch-c166-muted",null,
            `${footMousePlan.covered} déjà correct(s) · ${footMousePlan.changes.length} nouveau(x) bouton(s) proposé(s) · ${footMousePlan.skipped.length} ignoré(s).`),
          btn("Préparer les boutons souris",()=>this.stageAdvice(footMousePlan),
            !footMousePlan.changes.length||this.loading||this.saving),
          h("p.edch-c166-muted",null,
            "Uniquement les boutons présents dans le fichier source. Aucun axe ni touche existante remplacé.")):null,
      h("p.edch-c166-muted",null,"Le brouillon ne modifie aucun fichier. Les touches occupées et les axes analogiques sont préservés."));
    const namingPanel=h("section.edch-named-preset",{role:"region","aria-label":"Nom du préréglage Elite Dangerous"},
      h("h4",null,"Nom du préréglage dans le jeu"),
      h("p.edch-c166-muted",null,
        "Le nom ci-dessous sera identique dans le fichier .binds et dans le menu Odyssey. Un même nom est réutilisé au lieu de créer EDCHPro0001, EDCHPro0002…"),
      h("label.edch-c166-field",null,"Nom enregistré dans Odyssey",
        h("input",{type:"text",maxLength:40,value:targetName,spellcheck:false,
          "aria-label":"Nom du profil nommé Odyssey",
          oninput:(e:Event)=>{
            this.customPresetName=(e.target as HTMLInputElement).value.toUpperCase();
            this.confirmNamedUpdate=false;
          },
          onblur:()=>this.repaint(),
        })),
      !safeEdchPresetName(targetName)
        ?h("p.edch-c166-warning",null,
          "Nom invalide : commence par EDCH_ et utilise uniquement A–Z, 0–9 et _ (40 caractères maximum)."):null,
      existingNamed?h("div.edch-named-existing",null,
        h("strong",null,"Ce nom existe déjà : "+sameNamedFiles.join(" · ")),
        h("label",null,h("input",{type:"checkbox",checked:this.confirmNamedUpdate,
          onchange:(e:Event)=>{this.confirmNamedUpdate=(e.target as HTMLInputElement).checked;this.repaint();}}),
          " Mettre à jour ce profil nommé. Sauvegarder automatiquement l'ancienne version dans EDCH_Backups avant remplacement.")):null,
      h("p.edch-c166-muted",null,
        "Les anciens EDCHPro restent intacts. Pour éviter des noms en double, conserve ce même nom pour les mises à jour de ce réglage."),
    );
    const footCoverage=completeFoot?h("section.edch-foot-coverage",null,
      h("h4",null,"Couverture des commandes à pied · AZERTY étendu"),
      h("p",null,
        completeFoot.allActions+" actions À pied reconnues · "+completeFoot.changes.length+
        " propositions clavier/souris · "+completeFoot.covered+" déjà conformes · "+
        completeFoot.preservedAxes+" axe(s) conservé(s)."),
      h("p.edch-c166-muted",null,
        completeFoot.unassigned.length+" action(s) sans affectation numérique après application des propositions."),
      completeFoot.unassigned.length?h("details",null,
        h("summary",null,"Afficher les commandes encore sans touche"),
        ...completeFoot.unassigned.map(a=>h("p.edch-c166-muted",null,
          localizedActionLabel(meta,a)+" ("+a+")"))):null,
      completeFoot.skipped.length?h("details",null,
        h("summary",null,completeFoot.skipped.length+" proposition(s) non appliquées et causes"),
        ...completeFoot.skipped.map(x=>h("p.edch-c166-muted",null,
          localizedActionLabel(meta,x.action)+" : "+x.key+" — "+x.reason))):null,
      h("p.edch-c166-muted",null,
        "Les commandes sans touche ou absentes ne sont jamais présentées comme configurées. Vérifie les avertissements avant de créer un profil."),
    ):null;
    const draftBox=h("section.edch-c166-pane",null,h("h4",null,`Brouillon à valider (${this.staged.length})`),
      this.staged.length?h("div.edch-c166-draft",null,...this.staged.map((change,index)=>h("div.edch-c166-draft-line",null,
        h("span",null,h("strong",null,localizedActionLabel(meta,change.action)),
          h("small",null,change.replaceExisting
            ?`${labelSlot(change.slot)} : ${readKey(src?.binds.find(b=>b.action===change.action&&b.slot===change.slot))} → ${change.device} : ${change.key} (remplacement dans le NOUVEAU profil)`
            :`${labelSlot(change.slot)} : libre → ${change.device} : ${change.key}`)),
        btn("Retirer",()=>{this.staged.splice(index,1);this.acknowledgeWarnings=false;this.repaint();})))):
        h("p.edch-c166-muted",null,"Aucune modification préparée. Ton profil original est conservé."),
      editsWarnings.length?h("div.edch-c166-warning",null,
        h("strong",null,"Points à examiner"),...editsWarnings.map(x=>h("p",null,x)),
        h("label.edch-c166-ack",null,h("input",{type:"checkbox",checked:this.acknowledgeWarnings,
          onchange:(e:Event)=>{this.acknowledgeWarnings=(e.target as HTMLInputElement).checked;this.repaint();}}),
          " J'ai vérifié les touches partagées et j'accepte ce brouillon")):null,
      namingPanel,
      footCoverage,
      h("div.edch-c166-actions",null,
        btn(this.saving?"Enregistrement…":existingNamed?"Mettre à jour le préréglage nommé":"Créer le préréglage nommé",()=>{void this.save();},!canSave,"primary"),
        btn("Annuler le brouillon",()=>{this.staged=[];this.acknowledgeWarnings=false;this.repaint();},!this.staged.length||this.saving)),
      this.message?h("p",{role:"status",class:"edch-c166-status"},this.message):null,
      h("p.edch-c166-muted",null,"Les axes restent inchangés. Ferme Elite Dangerous et son lanceur avant de créer ce profil nommé ; sélectionne ensuite son nom exact dans les préréglages du jeu : Vaisseau, VRS ou À pied selon le contexte."));
    const hotas = this.family==="hotas" && this.mode==="ship" ? this.hotasStudio.render(src?.binds ?? [], (candidate: Bind) => {
      const input = inputCatalog(src?.binds ?? []).find(b => bindingKey(b) === bindingKey(candidate));
      if (!input) return;
      this.editInput = bindingKey(input);
      this.message = `HOTAS : ${candidate.device} ${candidate.key} sélectionné. Choisis une commande, puis ajoute au brouillon.`;
      this.repaint();
    }) : null;
    const modeProfiles=this.family==="hotas" && this.mode==="ship" ? this.x52Modes.render(meta,src?.actions ?? [],src?.binds ?? [],this.selected,(modeId) => {
      if (!src) return;
      const style: SuggestedProfile = modeId===1 ? "navigation" : modeId===2 ? "combat" : "exploration";
      this.profile=style;
      const advice=recommendScopedProfile("ship","hotas",style,src.actions,src.binds,meta);
      if (advice.changes.length) this.stageAdvice(advice);
      else {
        this.message=`Mode ${modeId} — ${style} : aucune attribution HOTAS vérifiable à ajouter automatiquement. Les commandes existantes sont conservées ; tu peux les modifier avec P/S.`;
        this.repaint();
      }
    }) : null;
    const right=h("div.edch-c166-right",null,
      hotas,
      this.family==="xbox" ? h("p.edch-c166-muted",null,
        "Xbox : le schéma identifie les boutons du profil actif. Un clic sélectionne le bouton reconnu pour faciliter son attribution à une commande.") : null,
      this.family==="hotas" ? h("p.edch-c166-muted",null,
        "HOTAS : profils X52 Pro/X56 selon les affectations observées. Les numéros Linux ne sont pas des boutons Elite vérifiés.") : null,
      editBox,adviceBox,draftBox);
    const xboxDiagram=this.family==="xbox" ? xboxControllerDiagram({
      meta,scope:this.mode,original:src?.binds??[],draft:this.staged,
      selected:this.inspectedXbox,sourceLoaded:Boolean(src),
      onSelect:(control)=>{
        this.inspectedXbox=control;
        const match=inputs.find(b=>xboxControl(b.device,b.key,meta)===control);
        if(match)this.editInput=bindingKey(match);
        this.repaint("xbox");
      },
    }) : null;
    const azertyKeyboard=this.family==="azerty" ? virtualAzertyKeyboard({
      meta,scope:this.mode,original:src?.binds??[],draft:this.staged,
      selectedKey:this.inspectedKey,sourceLoaded:Boolean(src),
      onSelect:(key)=>{
        this.inspectedKey=key;
        this.repaint("keyboard");
      },
    }) : null;
    const footMouse=this.family==="azerty"&&this.mode==="foot" ? virtualFootMouse({
      meta,original:src?.binds??[],draft:this.staged,sourceLoaded:Boolean(src),
      selected:this.inspectedMouse,
      onSelect:(id)=>{
        this.inspectedMouse=id;
        const mouse=inputs.find(b=>b.device==="Mouse"&&b.key===id);
        if(mouse)this.editInput=bindingKey(mouse);
        this.repaint("mouse");
      },
    }) : null;
    // Keep the AZERTY keyboard visible *inside* the modal: the page behind is dimmed.
    // Mouse capture is isolated in a dedicated target so virtual keyboard clicks
    // cannot accidentally become a Mouse_1 assignment.
    const captureKeyboard=this.captureMode&&src?virtualAzertyKeyboard({
      meta,scope:"foot",original:src.binds,draft:this.staged,
      selectedKey:"",sourceLoaded:true,captureMode:true,
      onSelect:(key)=>{
        const input=captureVirtualFootKey(key);
        if(input)this.applyCapturedInput(input,meta);
        else {this.captureStatus="Cette touche n'est pas disponible pour l'attribution directe.";this.repaint("capture");}
      },
    }):null;
    const captureOverlay=this.captureMode&&this.mode==="foot"&&this.family==="azerty"&&src
      ?h("div.edch-c166-capture-overlay",{
        role:"dialog","aria-modal":"true",tabIndex:0,
        "aria-label":"Choisir une touche sur le clavier virtuel AZERTY",
        onkeydown:(e:KeyboardEvent)=>{
          if(e.key==="Escape"){
            e.preventDefault();e.stopPropagation();
            this.captureMode=false;this.captureStatus="";
            this.message="Capture annulée. Aucune touche modifiée.";this.repaint();return;
          }
          // Let focused on-screen buttons activate on Enter/Space.
          const target=e.target as HTMLElement;
          if(target.closest("button")&&(e.key==="Enter"||e.key===" ")){
            e.stopPropagation();return;
          }
          e.preventDefault();e.stopPropagation();
          const input=captureKeyboardForFoot(e);
          if(!input){
            this.captureStatus="Touche non prise en charge. Utilise une touche seule ou clique sur le clavier AZERTY affiché.";
            this.repaint("capture");return;
          }
          this.applyCapturedInput(input,meta);
        },
      },
        h("div.edch-c166-capture-dialog",null,
          h("h4",null,"Attribution directe · "+localizedActionLabel(meta,this.editAction)),
          h("p",null,labelSlot(this.editSlot)+
            " : clique sur une touche du clavier AZERTY affiché, ou utilise ton clavier physique."),
          h("div.edch-c166-capture-keyboard",null,captureKeyboard),
          h("div.edch-c166-capture-mouse-zone",{
            tabIndex:0,role:"button",
            "aria-label":"Zone pour attribuer un bouton de souris ; cliquer avec le bouton voulu",
            onmousedown:(e:MouseEvent)=>{
              e.preventDefault();e.stopPropagation();
              const input=captureMouseForFoot(e.button);
              if(!input){
                this.captureStatus="Bouton de souris non pris en charge.";
                this.repaint("capture");return;
              }
              this.applyCapturedInput(input,meta);
            },
            oncontextmenu:(e:MouseEvent)=>{e.preventDefault();e.stopPropagation();},
          },
            h("strong",null,"Souris : clique dans cette zone avec le bouton à attribuer"),
            h("small",null,"Gauche, droit, molette ou bouton latéral reconnu dans le fichier .binds."),
          ),
          h("p.edch-c166-muted",null,
            "Échap pour annuler. Les combinaisons Ctrl/Alt/Maj, la ponctuation particulière et les axes ne sont pas capturés. Les touches indisponibles sont grisées."),
          this.captureStatus?h("p.edch-c166-capture-error",{role:"status"},this.captureStatus):null,
          h("button.edch-c166-capture-cancel",{
            type:"button",
            onclick:()=>{this.captureMode=false;this.captureStatus="";
              this.message="Capture annulée.";this.repaint();},
          },"Annuler (Échap)"),
        ),
      ):null;
    this.host=h("section.card.edch-controls-write-v166",null,heading,
      h("p.edch-c166-muted",{style:{padding:"0 16px"}},
        "Onglet : "+currentContext.label+" · Interface / cartes et diagnostics complémentaires dans les outils avancés."), 
      src && this.family==="azerty" && !/^(fr|nl-BE)(-|$)/i.test(src.keyboardLayout)
        ? h("p.edch-c166-warning",null,"Le jeu indique le clavier "+src.keyboardLayout+". Vérifie AZERTY avant de valider.") : null,
      !names.length?h("p.edch-c166-warning",null,"Aucun profil .binds personnel : modifie puis enregistre une touche dans Elite Dangerous pour créer Custom."):null,
      energyLinkCard,
      inGameCard,
      quickCards,
      azertyKeyboard,
      footMouse,
      xboxDiagram,
      h("div.edch-c166-layout",null,rowPane,right),
      captureOverlay,
      modeProfiles,
      h("p.edch-c166-credits",null,"Auteur original EDCH : CMDR MDLuffy · Extensions Commandes/BGS : Cyberpunk Philou. Modifications uniquement après validation."));
    return this.host;
  }

  private repaint(focus?:"search"|"keyboard"|"xbox"|"mouse"|"capture") {
    const c=this.context;
    if (!this.host?.isConnected||!c)return;
    this.host.replaceWith(this.render(c.meta,c.files,c.active,c.reload));
    if(focus==="capture"){
      this.host.querySelector<HTMLElement>(".edch-c166-capture-overlay")?.focus({preventScroll:true});
    }
    if(focus==="keyboard"&&this.inspectedKey){
      const next=this.host.querySelector<HTMLButtonElement>('button.edch-vkb-key[data-key="'+this.inspectedKey+'"]');
      next?.focus({preventScroll:true});
    }
    if(focus==="mouse"&&this.inspectedMouse){
      const btn=this.host.querySelector<HTMLButtonElement>('button.edch-mouse-btn[data-mouse-control="'+this.inspectedMouse+'"]');
      btn?.focus({preventScroll:true});
    }
    if(focus==="xbox"&&this.inspectedXbox){
      const btn=this.host.querySelector<HTMLButtonElement>('button.edch-xbox-control[data-xbox-control="'+this.inspectedXbox+'"]');
      btn?.focus({preventScroll:true});
    }
    if(focus==="search"){const input=this.host.querySelector<HTMLInputElement>(".edch-c166-search input");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}
  }
  private async loadSource(name:string) {
    const gen=++this.generation;this.attempted=name;this.loading=true;this.repaint();
    try {
      const xml=await readOptionFile("Bindings",name);
      if(gen!==this.generation||name!==this.selected)return;
      const parsed=parseBinds(xml);
      this.source={filename:name,preset:parsed.preset,binds:parsed.binds,actions:actionsFromXml(xml),keyboardLayout:parsed.keyboardLayout};
      this.message="";
    } catch(e){if(gen===this.generation)this.message=`Lecture impossible : ${String(e)}`;}
    finally{if(gen===this.generation){this.loading=false;this.repaint();}}
  }
  /** P/S on Odyssey: a captured key becomes a pending change, never a live game edit.
   * Warn about occupied slots and hard-stop on a collision in the On Foot context.
   */
  private applyCapturedInput(input:CapturedDigitalInput,meta:BindsMeta) {
    const src=this.source,action=this.editAction,slot=this.editSlot;
    if(!src||this.mode!=="foot"||this.family!=="azerty"||!src.actions.includes(action)){
      this.captureMode=false;this.message="Sélection invalide : choisis à nouveau une commande À pied.";this.repaint();return;
    }
    const old=src.binds.find(b=>b.action===action&&b.slot===slot);
    if(old&&old.device===input.device&&old.key===input.key&&!old.modifiers.length){
      this.captureMode=false;this.message="Cette touche est déjà attribuée à cette commande.";this.repaint();return;
    }
    const next:PresetAssignment={action,slot,device:input.device,key:input.key,modifiers:[],
      replaceExisting:Boolean(old)};
    if(!isStagedAssignmentValid(next,src.actions,src.binds)){
      this.captureStatus=input.device==="Mouse"
        ?input.label+" : bouton non enregistré dans le profil .binds. Attribue-le d'abord dans Odyssey puis actualise EDCH."
        :"Touche non compatible avec les profils Odyssey gérés par EDCH.";
      this.repaint("capture");return;
    }
    const sameContext=(otherAction:string)=>groupOf(meta,otherAction)===groupOf(meta,action);
    const sameInput=(d:Pick<Bind,"device"|"key"|"modifiers">)=>
      d.device===input.device&&d.key===input.key&&d.modifiers.length===0;
    const originalCollision=src.binds.find(b=>b.slot!=="axis"&&sameContext(b.action)&&sameInput(b)&&
      !(b.action===action&&b.slot===slot) &&
      !this.staged.some(c=>c.action===b.action&&c.slot===b.slot&&c.replaceExisting));
    const stagedCollision=this.staged.find(c=>sameContext(c.action)&&sameInput(c)&&
      !(c.action===action&&c.slot===slot));
    const collision=originalCollision?.action??stagedCollision?.action;
    if(collision){
      this.captureStatus="Touche "+input.label+" déjà utilisée à pied pour « "+
        localizedActionLabel(meta,collision)+" ». Choisis une autre touche.";
      this.repaint("capture");return;
    }
    if(old&&!window.confirm("Remplacer "+readKey(old)+" par "+input.device+" : "+input.key+
        " pour « "+localizedActionLabel(meta,action)+" » ?\\n"+
        "Le remplacement concerne UNIQUEMENT le nouveau profil à créer ; le fichier actuel reste intact.")){
      this.captureStatus="Remplacement non confirmé. Choisis une autre touche ou appuie sur Échap.";
      this.repaint("capture");return;
    }
    this.staged=this.staged.filter(c=>c.action!==action||c.slot!==slot).concat(next);
    this.acknowledgeWarnings=false;
    this.replace=Boolean(old);
    this.captureMode=false;this.captureStatus="";
    this.message="Touche détectée : "+input.label+" → "+localizedActionLabel(meta,action)+
      " ("+labelSlot(slot)+"). Ajoutée au brouillon : crée ensuite un nouveau profil pour le jeu.";
    this.repaint();
  }
  private stageSingle(meta:BindsMeta){
    const source=this.source;
    const selected=inputCatalog(source?.binds??[]).find(b=>bindingKey(b)===this.editInput);
    if(!source||!selected||!source.actions.includes(this.editAction))return;
    const next:PresetAssignment={action:this.editAction,slot:this.editSlot,device:selected.device,key:selected.key,
      modifiers:selected.modifiers.map(x=>({...x})),replaceExisting:this.replace};
    if(!isStagedAssignmentValid(next,source.actions,source.binds))return;
    this.staged=this.staged.filter(x=>x.action!==next.action||x.slot!==next.slot).concat(next);
    this.acknowledgeWarnings=false;this.message="";this.repaint();
  }
  private stageAdvice(advice:{changes:PresetAssignment[]}|undefined){
    if(!advice?.changes.length)return;
    if(this.staged.length&&!window.confirm("Remplacer le brouillon par les suggestions ? Le profil du jeu ne sera pas modifié."))return;
    this.staged=advice.changes.map(c=>({...c,modifiers:c.modifiers.map(m=>({...m}))}));
    this.acknowledgeWarnings=false;this.message=`${this.staged.length} suggestion(s) prêtes. Vérifie chaque touche avant de créer un profil.`;this.repaint();
  }
  /** Reveals the actual bindings file's directory in Manjaro/Windows.
   * Never assumes a particular Steam/Proton prefix.
   */
  private async openBindingsFolder(){
    if(!isTauri()||isRemote()||this.inGameGuideBusy)return;
    this.inGameGuideBusy=true;
    try{
      const root=await optionsDir();
      const filename=this.lastCreated?.filename??this.selected;
      if(!/^[A-Za-z0-9_.-]+[.]binds$/.test(filename))throw new Error("Aucun profil .binds à afficher.");
      const path=this.lastCreated?.path??root+"/Bindings/"+filename;
      await revealPath(path);
      this.inGameGuideMessage="Le gestionnaire de fichiers affiche le dossier des profils Odyssey.";
    }catch(e){this.inGameGuideMessage="Ouverture du dossier impossible : "+String(e);}
    finally{this.inGameGuideBusy=false;this.repaint();}
  }
  private async verifyInGamePreset(){
    if(!isTauri()||isRemote()||this.inGameGuideBusy)return;
    this.inGameGuideBusy=true;
    try{
      const files=await listOptionFiles();
      const start=files.filter(f=>f.folder==="Bindings"&&/^StartPreset([.]4)?[.]start$/i.test(f.name))
        .sort((a,b)=>Number(b.name.toLowerCase()==="startpreset.4.start")-Number(a.name.toLowerCase()==="startpreset.4.start"))[0];
      const text=start?await readOptionFile("Bindings",start.name):null;
      this.inGameStatus=inGameOnFootStatus(text,this.lastCreated?.preset??this.source?.preset??null);
      this.inGameGuideMessage="Vérification de StartPreset effectuée en lecture seule.";
    }catch(e){this.inGameStatus=inGameOnFootStatus(null,this.lastCreated?.preset??this.source?.preset??null);
      this.inGameGuideMessage="Lecture du préréglage actif impossible : "+String(e);}
    finally{this.inGameGuideBusy=false;this.repaint();}
  }
  private async refreshAfterGameChanges(){
    if(!isTauri()||isRemote()||this.inGameGuideBusy)return;
    if(this.staged.length&&!window.confirm("Actualiser depuis le jeu et abandonner le brouillon non enregistré ?"))return;
    const ctx=this.context;if(!ctx)return;
    this.inGameGuideBusy=true;
    try{
      const files=await listOptionFiles();
      const start=files.filter(f=>f.folder==="Bindings"&&/^StartPreset([.]4)?[.]start$/i.test(f.name))
        .sort((a,b)=>Number(b.name.toLowerCase()==="startpreset.4.start")-Number(a.name.toLowerCase()==="startpreset.4.start"))[0];
      const text=start?await readOptionFile("Bindings",start.name):null;
      const current=text?onFootPresetFromStartFile(text):null;
      const activeFile=current?fileForPreset(current,files.filter(f=>f.folder==="Bindings").map(f=>f.name)):undefined;
      if(activeFile)this.selected=activeFile;
      this.source=undefined;this.attempted="";this.staged=[];this.acknowledgeWarnings=false;
      this.generation++;
      this.inGameStatus=inGameOnFootStatus(text,this.lastCreated?.preset??current);
      this.inGameGuideMessage=activeFile
        ?"Relecture du profil « "+current+" » demandé. Les affectations modifiées dans Odyssey sont rechargées."
        :"Profils relus. Si le jeu a changé de préréglage, sélectionne manuellement son fichier .binds.";
      await ctx.reload();
    }catch(e){this.inGameGuideMessage="Relecture des commandes impossible : "+String(e);}
    finally{this.inGameGuideBusy=false;this.repaint();}
  }
  private async save(){
    const ctx=this.context,source=this.source;
    if(!ctx||!source||source.filename!==this.selected||!this.staged.length||this.saving||this.loading)return;
    if(!this.staged.every(c=>isStagedAssignmentValid(c,source.actions,source.binds)))return;
    const warnings=[...new Set([...occupancyWarnings(source.binds,this.staged,ctx.meta),
      ...scopedInputWarnings(source.binds,this.staged,ctx.meta)])];
    if(warnings.length&&!this.acknowledgeWarnings)return;
    const name=this.customPresetName||namedPreset(this.mode,this.family,this.profile);
    if(!safeEdchPresetName(name)) {this.message="Nom de préréglage invalide.";this.repaint();return;}
    const existing=matchedPresetFiles(name,ctx.files.filter(f=>f.folder==="Bindings").map(f=>f.name)).length>0;
    if(existing&&!this.confirmNamedUpdate){
      this.message="Ce nom existe déjà : confirme sa mise à jour et sa sauvegarde.";this.repaint();return;
    }
    if(!window.confirm(`${existing?"METTRE À JOUR":"CRÉER"} le profil nommé ${name} avec ${this.staged.length} attribution(s) ?\n\nSource : ${source.filename}\n${existing?"L'ancien préréglage nommé sera sauvegardé dans EDCH_Backups.":"Le fichier source reste intact."}\n\nVérifie le brouillon. Elite Dangerous et le lanceur doivent être fermés.`))return;
    this.saving=true;this.repaint();
    try{
      const out=await controlsSaveNamedPresetBatch(
        source.filename,this.staged,name,existing,this.mode==="foot"&&this.family==="azerty");
      this.staged=[];this.acknowledgeWarnings=false;this.confirmNamedUpdate=false;
      this.lastCreated={preset:out.preset,filename:out.filename,path:out.path};
      this.selected=out.filename;this.source=undefined;this.attempted="";
      this.inGameStatus=null;
      this.inGameGuideMessage="Profil prêt : démarre Odyssey, ouvre Options → Commandes → À pied et sélectionne « "+out.preset+" ».";
      this.message="Profil nommé "+out.preset+" enregistré (source préservée ou ancien profil sauvegardé). Sélectionne-le et applique-le dans les commandes correspondantes du jeu.";
      await ctx.reload();
    }catch(e){this.message=`Création du profil refusée : ${String(e)}`;}
    finally{this.saving=false;this.repaint();}
  }
}
