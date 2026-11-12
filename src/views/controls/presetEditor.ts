/** EDCH v1.6.6 — Elite-style controls workbench with explicit review-before-save.
 * No live game input, local ML, network data, hidden profile changes or fabricated device buttons.
 */
import { type BindsMeta, type Bind, parseBinds, parseXml } from "../../features/controls/binds.js";
import { localizedActionLabel} from "../../features/controls/actionLabels.js";
import { controlsSavePresetBatch, isRemote, isTauri, readOptionFile, type OptionFile } from "../../platform/bridge.js";
import {
  bindingKey, catalogRows, inputCatalog, isStagedAssignmentValid, occupancyWarnings,
  recommendProfile, type PresetAssignment, type SuggestedProfile,
} from "../../features/controls/presetAdvisor.js";
import { h } from "../../ui/dom.js";
import {
  detectedInputs, GAME_SCOPES, INPUT_FAMILIES, recommendScopedProfile, scopedInputWarnings, USAGE_STYLES,
  type GameScope, type InputFamily,
} from "../../features/controls/scopedProfiles.js";
import { HotasStudio } from "./hotasStudio.js"; // EDCH-HOTAS-STUDIO-v1.6.7
import { X52ModesPanel } from "./x52ModesPanel.js"; // EDCH-X52-MODES-v1.6.8

interface SourceState { filename: string; actions: string[]; binds: Bind[]; keyboardLayout: string }
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
  private profile:SuggestedProfile="balanced";
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

  render(meta:BindsMeta, files:OptionFile[], active:string, reload:()=>Promise<void>, scope:GameScope="ship"):HTMLElement {
    this.context={meta,files,active,reload};
    if(this.mode!==scope){this.mode=scope;this.staged=[];this.acknowledgeWarnings=false;this.editAction="";this.message="";}
    const names=files.filter(f=>f.folder==="Bindings" && f.name.toLowerCase().endsWith(".binds") && f.size<=5_000_000)
      .map(f=>f.name).sort((a,b)=>a.localeCompare(b,"fr"));
    if (!names.includes(this.selected)) {
      this.selected=names.includes(active)?active:names[0]??"";
      this.source=undefined;this.attempted="";this.staged=[];this.editAction="";
    }
    if (this.selected && this.source?.filename!==this.selected && this.attempted!==this.selected && !this.loading) void this.loadSource(this.selected);
    const src=this.source?.filename===this.selected?this.source:undefined;
    const inputs=src?detectedInputs(src.binds,this.family,meta):[];
    const deviceAdvice=src?recommendScopedProfile(this.mode,this.family,this.profile,src.actions,src.binds,meta):undefined;
    const rows=src?catalogRows(src.actions,src.binds,meta,this.mode,this.query,a=>localizedActionLabel(meta,a)):[];
    if (src && this.editAction && !src.actions.includes(this.editAction)) this.editAction="";
    if (!inputs.some(x=>bindingKey(x)===this.editInput))this.editInput=inputs.length?bindingKey(inputs[0]):"";
    const editsWarnings=src?[...new Set([...occupancyWarnings(src.binds,this.staged,meta),
      ...scopedInputWarnings(src.binds,this.staged,meta)])]:[];
    const canSave=Boolean(src && this.staged.length && this.staged.every(x=>isStagedAssignmentValid(x,src.actions,src.binds))
      && (!editsWarnings.length || this.acknowledgeWarnings) && isTauri() && !isRemote() && !this.loading && !this.saving);
    const selectedAction=src?.actions.includes(this.editAction)?this.editAction:"";
    const old=src?.binds.find(b=>b.action===selectedAction&&b.slot===this.editSlot);
    const selectedInput=inputs.find(x=>bindingKey(x)===this.editInput);
    const choose=(label:string,value:string,selected=false)=>h("option",{value,selected},label);
    const btn=(text:string,fn:()=>void,disabled=false,style="")=>h(`button.edch-c166-btn${style?"."+style:""}`,{type:"button",disabled,onclick:fn},text);
    const sourceSelect=h("label.edch-c166-source",null,"Profil Elite Dangerous",h("select",{value:this.selected,disabled:this.loading||this.saving,
      onchange:(e:Event)=>{this.generation++;this.selected=(e.target as HTMLSelectElement).value;this.source=undefined;
        this.attempted="";this.staged=[];this.editAction="";this.message="";this.repaint();},
    },...names.map(name=>choose(name,name,name===this.selected))));
    const heading=h("div.edch-c166-heading",null,
      h("div",null,h("p.edch-c166-eyebrow",null,"ELITE DANGEROUS · CONFIGURATION"),h("h3",null,"Commandes · configuration simplifiée v1.6.10"),
        h("p.edch-c166-muted",null,"Affectations du profil, suggestions locales et création d'un nouveau préréglage pour le jeu.")),
      h("div.edch-c166-hero-right",null,sourceSelect,h("span.edch-c166-chip",null,
        this.loading?"Lecture…":this.saving?"Enregistrement…":src?`${src.actions.length} commandes · ${src.binds.length} affectations`:"Profil non chargé")));
    const topTabs=h("div.edch-c166-tabs",{role:"tablist","aria-label":"Périphériques"},...INPUT_FAMILIES.map(x=>
      h("button",{type:"button",role:"tab","aria-selected":this.family===x.id,class:this.family===x.id?"active":"",
        onclick:()=>{
          if(this.family===x.id)return;
          if(this.staged.length&&!window.confirm("Changer de périphérique et abandonner le brouillon non enregistré ?"))return;
          this.family=x.id;this.staged=[];this.acknowledgeWarnings=false;this.editInput="";this.message="";
          this.repaint();
        }},x.label)));
    const search=h("label.edch-c166-search",null,"Rechercher",h("input",{type:"search",value:this.query,maxLength:120,
      placeholder:"Rechercher une commande française ou son identifiant…",oninput:(e:Event)=>{
        this.query=(e.target as HTMLInputElement).value;this.repaint("search");
      }}));
    const table=h("div.edch-c166-scroll",null,h("table.edch-c166-table",null,
      h("thead",null,h("tr",null,...["Commande","Principale","Secondaire","Attribuer"].map(s=>h("th",null,s)))),
      h("tbody",null,...rows.slice(0,200).map(row=>{
        const button=(slot:"primary"|"secondary")=>btn(slot==="primary"?"P":"S",()=>{
          this.editAction=row.action;this.editSlot=slot;this.replace=false;this.message="";this.repaint();
        },false, this.editAction===row.action&&this.editSlot===slot?"selected":"");
        const value=(b?:Bind)=>h("span",{class:b?"edch-c166-bound":"edch-c166-unbound"},b?readKey(b):"— Libre —");
        return h("tr",{class:this.editAction===row.action?"edch-c166-current":""},
          h("td",null,h("strong",null,localizedActionLabel(meta,row.action)),h("small",null,row.action)),
          h("td",null,value(row.primary)),h("td",null,value(row.secondary)),h("td",null,button("primary")," ",button("secondary")));
      })),
    ),
    rows.length>200?h("p.edch-c166-muted",null,`200 sur ${rows.length} commandes affichées : affine la recherche.`):null,
    !rows.length?h("p.edch-c166-muted",null,"Aucune commande pour cette recherche."):null);
    const currentContext=GAME_SCOPES.find(x=>x.id===this.mode)!;
    const rowPane=h("section.edch-c166-pane.edch-c166-list",null,
      h("div.edch-c166-section-title",null,h("h4",null,currentContext.label),
        h("span",null,`${rows.length} commande(s)`)),
      h("p.edch-c166-muted",null,currentContext.description),
      h("h4",null,"Choisir le périphérique"),topTabs,
      h("p.edch-c166-muted",null,`${inputs.length} entrée(s) de ce type réellement présentes dans le fichier source.`),
      search,table);
    const chooseInput=h("select",{value:this.editInput,disabled:this.saving||!src,
      onchange:(e:Event)=>{this.editInput=(e.target as HTMLSelectElement).value;this.repaint();}},...inputs.map(i=>choose(readKey(i),bindingKey(i),this.editInput===bindingKey(i))));
    const editBox=h("section.edch-c166-pane",null,
      h("h4",null,"Modifier une attribution"),
      selectedAction ? h("div",null,
        h("p.edch-c166-keyname",null,localizedActionLabel(meta,selectedAction)),
        h("p.edch-c166-muted",null,`${labelSlot(this.editSlot)} · actuelle : ${readKey(old)}`),
        h("label.edch-c166-field",null,`Bouton reconnu — ${INPUT_FAMILIES.find(x=>x.id===this.family)!.label}`,chooseInput),
        old?h("label.edch-c166-ack",null,h("input",{type:"checkbox",checked:this.replace,onchange:(e:Event)=>{
          this.replace=(e.target as HTMLInputElement).checked;this.repaint();}})," Remplacer cet emplacement dans le nouveau profil"):null,
        btn("Ajouter au brouillon",()=>this.stageSingle(meta),!selectedInput||(Boolean(old)&&!this.replace)||this.loading||this.saving,"primary"),
      ):h("p.edch-c166-muted",null,"Choisis P (principale) ou S (secondaire) à droite d'une commande."));
    const adviceBox=h("section.edch-c166-pane",null,
      h("h4",null,"Profils intelligents · "+INPUT_FAMILIES.find(x=>x.id===this.family)!.label),
      h("p.edch-c166-muted",null,"Suggestions locales et vérifiables pour "+currentContext.label+". Aucun numéro HOTAS ou Xbox n'est inventé."),
      h("label.edch-c166-field",null,"Profil conseillé",h("select",{value:this.profile,disabled:this.loading||this.saving,
        onchange:(e:Event)=>{this.profile=(e.target as HTMLSelectElement).value as SuggestedProfile;this.repaint();}},
        ...USAGE_STYLES.map(x=>choose(x.label,x.id,x.id===this.profile)))),
      deviceAdvice?h("p",null,`${deviceAdvice.covered}/${deviceAdvice.relevant} commande(s) déjà configurée(s) sur ce périphérique · ${deviceAdvice.changes.length} proposition(s) sûre(s).`):null,
      deviceAdvice?.absent.length?h("p.edch-c166-muted",null,`${deviceAdvice.absent.length} action(s) inexistante(s) dans ce .binds : ignorées.`):null,
      ... (deviceAdvice?.warnings ?? []).map(w=>h("p.edch-c166-muted",null,w)),
      btn("Préparer les suggestions",()=>this.stageAdvice(deviceAdvice),!deviceAdvice?.changes.length||this.loading||this.saving,"primary"),
      h("p.edch-c166-muted",null,"Le brouillon ne modifie aucun fichier. Les touches occupées et les axes analogiques sont préservés."));
    const draftBox=h("section.edch-c166-pane",null,h("h4",null,`Brouillon à valider (${this.staged.length})`),
      this.staged.length?h("div.edch-c166-draft",null,...this.staged.map((change,index)=>h("div.edch-c166-draft-line",null,
        h("span",null,h("strong",null,localizedActionLabel(meta,change.action)),
          h("small",null,`${labelSlot(change.slot)} → ${change.device} ${change.key}`)),
        btn("Retirer",()=>{this.staged.splice(index,1);this.acknowledgeWarnings=false;this.repaint();})))):
        h("p.edch-c166-muted",null,"Aucune modification préparée. Ton profil original est conservé."),
      editsWarnings.length?h("div.edch-c166-warning",null,
        h("strong",null,"Points à examiner"),...editsWarnings.map(x=>h("p",null,x)),
        h("label.edch-c166-ack",null,h("input",{type:"checkbox",checked:this.acknowledgeWarnings,
          onchange:(e:Event)=>{this.acknowledgeWarnings=(e.target as HTMLInputElement).checked;this.repaint();}}),
          " J'ai vérifié les touches partagées et j'accepte ce brouillon")):null,
      h("div.edch-c166-actions",null,
        btn(this.saving?"Création du profil…":"Créer un nouveau profil pour Elite Dangerous",()=>{void this.save();},!canSave,"primary"),
        btn("Annuler le brouillon",()=>{this.staged=[];this.acknowledgeWarnings=false;this.repaint();},!this.staged.length||this.saving)),
      this.message?h("p",{role:"status",class:"edch-c166-status"},this.message):null,
      h("p.edch-c166-muted",null,"Les axes restent inchangés. Ferme Elite Dangerous et son lanceur avant de créer le profil ; sélectionne ensuite EDCHPro dans les préréglages du jeu (Général, Vaisseau, VRS et À pied selon la catégorie)."));
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
      const advice=recommendProfile(style,src.actions,src.binds,meta);
      if (advice.changes.length) this.stageAdvice(advice);
      else {
        this.message=`Mode ${modeId} — ${advice.name} : aucune attribution sûre à ajouter automatiquement. Les commandes existantes sont conservées ; tu peux les modifier avec P/S.`;
        this.repaint();
      }
    }) : null;
    const right=h("div.edch-c166-right",null,
      hotas,
      this.family==="xbox" ? h("p.edch-c166-muted",null,
        "Xbox : les boutons doivent d'abord être reconnus et enregistrés dans le jeu. EDCH ne déduit pas la numérotation de Proton.") : null,
      this.family==="hotas" ? h("p.edch-c166-muted",null,
        "HOTAS : profils X52 Pro/X56 selon les affectations observées. Les numéros Linux ne sont pas des boutons Elite vérifiés.") : null,
      editBox,adviceBox,draftBox);
    this.host=h("section.card.edch-controls-write-v166",null,heading,
      h("p.edch-c166-muted",{style:{padding:"0 16px"}},
        "Onglet : "+currentContext.label+" · Interface / cartes et diagnostics complémentaires dans les outils avancés."), 
      src && this.family==="azerty" && !/^(fr|nl-BE)(-|$)/i.test(src.keyboardLayout)
        ? h("p.edch-c166-warning",null,"Le jeu indique le clavier "+src.keyboardLayout+". Vérifie AZERTY avant de valider.") : null,
      !names.length?h("p.edch-c166-warning",null,"Aucun profil .binds personnel : modifie puis enregistre une touche dans Elite Dangerous pour créer Custom."):null,
      h("div.edch-c166-layout",null,rowPane,right),
      modeProfiles,
      h("p.edch-c166-credits",null,"Auteur original EDCH : CMDR MDLuffy · Extensions Commandes/BGS : Cyberpunk Philou. Modifications uniquement après validation."));
    return this.host;
  }

  private repaint(focus?:"search") {
    const c=this.context;
    if (!this.host?.isConnected||!c)return;
    this.host.replaceWith(this.render(c.meta,c.files,c.active,c.reload));
    if(focus){const input=this.host.querySelector<HTMLInputElement>(".edch-c166-search input");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}
  }
  private async loadSource(name:string) {
    const gen=++this.generation;this.attempted=name;this.loading=true;this.repaint();
    try {
      const xml=await readOptionFile("Bindings",name);
      if(gen!==this.generation||name!==this.selected)return;
      const parsed=parseBinds(xml);
      this.source={filename:name,binds:parsed.binds,actions:actionsFromXml(xml),keyboardLayout:parsed.keyboardLayout};
      this.message="";
    } catch(e){if(gen===this.generation)this.message=`Lecture impossible : ${String(e)}`;}
    finally{if(gen===this.generation){this.loading=false;this.repaint();}}
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
  private async save(){
    const ctx=this.context,source=this.source;
    if(!ctx||!source||source.filename!==this.selected||!this.staged.length||this.saving||this.loading)return;
    if(!this.staged.every(c=>isStagedAssignmentValid(c,source.actions,source.binds)))return;
    const warnings=[...new Set([...occupancyWarnings(source.binds,this.staged,ctx.meta),
      ...scopedInputWarnings(source.binds,this.staged,ctx.meta)])];
    if(warnings.length&&!this.acknowledgeWarnings)return;
    if(!window.confirm(`Créer un NOUVEAU profil EDCHPro avec ${this.staged.length} modification(s) ?\n\nProfil source : ${source.filename}\nLes profils existants restent intacts.\nFerme Elite Dangerous et son lanceur avant d'enregistrer.`))return;
    this.saving=true;this.repaint();
    try{
      const out=await controlsSavePresetBatch(source.filename,this.staged);
      this.staged=[];this.acknowledgeWarnings=false;
      this.message=`Profil ${out.preset} créé : ${out.path}. Choisis ce préréglage dans Options → Commandes du jeu après son redémarrage.`;
      await ctx.reload();
    }catch(e){this.message=`Création du profil refusée : ${String(e)}`;}
    finally{this.saving=false;this.repaint();}
  }
}
