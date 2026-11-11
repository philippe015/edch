/** EDCH Commandes PRO v1.6.5: explicitly creates a NEW game-readable .binds file, never live input injection. */
import { type BindsMeta, type Bind, parseBinds, parseXml } from "../../features/controls/binds.js";
import { localizedActionLabel } from "../../features/controls/actionLabels.js";
import { controlsSavePreset, isRemote, isTauri, readOptionFile, type OptionFile } from "../../platform/bridge.js";
import { h } from "../../ui/dom.js";

interface SourceState { filename: string; actions: string[]; binds: Bind[] }
const id = (entry: Bind) => JSON.stringify([entry.device,entry.key,entry.modifiers]);
const ACCEPTED = /^[A-Za-z0-9_]{1,100}$/;
export function actionsFromXml(xml: string): string[] {
  const root = parseXml(xml).children.find(node=>node.tag === "Root");
  if (!root) return [];
  return root.children.filter(node => ACCEPTED.test(node.tag) && node.children.some(child => child.tag === "Primary" || child.tag === "Secondary"))
    .map(node=>node.tag).sort((a,b)=>a.localeCompare(b));
}
/** Isolated form. All edits are staged until an explicit click and confirmation. */
export class ControlsPresetEditor {
  private selected="";
  private action="";
  private slot:"primary"|"secondary"="secondary";
  private input="";
  private confirmReplacement=false;
  private busy=false;
  private message="";
  private source?:SourceState;
  private host?:HTMLElement;
  private context?:{meta:BindsMeta;files:OptionFile[];active:string;reload:()=>Promise<void>};
  private generation=0;
  private attempted="";
  render(meta:BindsMeta, files:OptionFile[], active:string, reload:()=>Promise<void>):HTMLElement {
    this.context={meta,files,active,reload};
    const names=files.filter(f=>f.folder==="Bindings"&&f.name.toLowerCase().endsWith(".binds")&&f.size<=5_000_000).map(f=>f.name);
    if (!names.includes(this.selected)) {
      this.selected=names.includes(active)?active:names[0]??"";
      this.source=undefined;this.action="";this.input="";this.attempted="";
    }
    if (this.selected && this.source?.filename!==this.selected && this.attempted!==this.selected && !this.busy) void this.loadSource(this.selected);
    const source=this.source?.filename===this.selected ? this.source : undefined;
    if (source && !source.actions.includes(this.action)) this.action=source.actions[0]??"";
    const inputs=source?.binds.filter(b=>b.slot!=="axis")??[];
    // Only already observed input IDs: no fabricated joystick button or axis identifiers.
    const unique=[...new Map(inputs.map(b=>[id(b),b])).values()].sort((a,b)=>
      a.device.localeCompare(b.device)||a.key.localeCompare(b.key));
    if (unique.length&&!unique.some(x=>id(x)===this.input))this.input=id(unique[0]);
    const current=source?.binds.find(x=>x.action===this.action&&x.slot===this.slot);
    const selected=unique.find(x=>id(x)===this.input);
    const opt=(label:string,value:string,selected:boolean)=>h("option",{value,selected},label);
    const sourceSelect=h("select",{value:this.selected,disabled:this.busy,
      onchange:(e:Event)=>{
        this.selected=(e.target as HTMLSelectElement).value;
        this.source=undefined;this.action="";this.input="";this.attempted="";this.message="";this.confirmReplacement=false;
        this.repaint();
      },
    },...names.map(name=>opt(name,name,name===this.selected)));
    const actionSelect=h("select",{value:this.action,disabled:this.busy||!source,
      onchange:(e:Event)=>{this.action=(e.target as HTMLSelectElement).value;this.confirmReplacement=false;this.repaint();},
    },...(source?.actions??[]).map(action=>opt(`${localizedActionLabel(meta,action)} · ${action}`,action,this.action===action)));
    const inputSelect=h("select",{value:this.input,disabled:this.busy||!source,
      onchange:(e:Event)=>{this.input=(e.target as HTMLSelectElement).value;this.repaint();},
    },...unique.map(b=>opt(`${b.device} · ${b.key}${b.modifiers.length?" + "+b.modifiers.map(m=>m.key).join(" + "):""}`,
      id(b),id(b)===this.input)));
    const slotSelect=h("select",{value:this.slot,disabled:this.busy,
      onchange:(e:Event)=>{this.slot=(e.target as HTMLSelectElement).value as "primary"|"secondary";this.confirmReplacement=false;this.repaint();},
    },opt("Principal","primary",this.slot==="primary"),opt("Secondaire","secondary",this.slot==="secondary"));
    const replacing=Boolean(current);
    this.host=h("section.card.edch-controls-write-v165",null,
      h("h3",null,"Configuration Elite Dangerous · v1.6.5"),
      h("p.sub",null,"Crée un nouveau profil .binds directement dans le dossier du jeu. Aucun appui simulé, aucun profil existant écrasé. Fermer Elite Dangerous et son lanceur avant d'enregistrer."),
      names.length? h("div.legend-grid",null,
        h("label",null,"Profil source ",sourceSelect),
        h("label",null,"Commande à configurer ",actionSelect),
        h("label",null,"Emplacement ",slotSelect),
        h("label",null,"Touche ou bouton connu ",inputSelect),
      ):h("p.notice",null,"Aucun profil .binds personnel trouvé. Enregistre d'abord une affectation dans Elite Dangerous pour créer un profil Custom."),
      replacing?h("p.sub",null,`Affectation actuelle : ${current!.device} · ${current!.key}. Son remplacement ne concerne que le nouveau profil.`):null,
      replacing?h("label",null,h("input",{type:"checkbox",checked:this.confirmReplacement,
        onchange:(e:Event)=>{this.confirmReplacement=(e.target as HTMLInputElement).checked;this.repaint();}
      })," J'autorise explicitement le remplacement de cet emplacement dans le nouveau profil"):null,
      h("p.sub",null,"Les boutons HOTAS proposés proviennent du fichier .binds source. Les axes analogiques ne sont pas éditables dans cette version."),
      h("button.primary",{type:"button",disabled:this.busy||!source||!selected||!this.action||(replacing&&!this.confirmReplacement)||!isTauri()||isRemote(),
        onclick:()=>{void this.save();}},this.busy?"Création…":"Créer le profil pour Elite Dangerous"),
      this.message?h("p",{role:"status"},this.message):null,
      h("p.sub",null,"Après création : lancer le jeu → Options → Commandes → Préréglages, puis sélectionner le profil EDCHPro dans la catégorie voulue et appliquer. Avec Odyssey, vérifier séparément Général, Vaisseau, VRS et À pied."),
    );
    return this.host;
  }
  private repaint(){const c=this.context;if(this.host?.isConnected&&c)this.host.replaceWith(this.render(c.meta,c.files,c.active,c.reload));}
  private async loadSource(name:string){
    if(this.busy)return;
    const gen=++this.generation;this.attempted=name;this.busy=true;this.repaint();
    try{
      const xml=await readOptionFile("Bindings",name);
      if(gen!==this.generation||name!==this.selected)return;
      const parsed=parseBinds(xml);
      this.source={filename:name,binds:parsed.binds,actions:actionsFromXml(xml)};
      this.message="";
    }catch(e){this.message=`Lecture du profil impossible : ${String(e)}`;}finally{
      if(gen===this.generation){this.busy=false;this.repaint();}
    }
  }
  private async save(){
    const ctx=this.context,source=this.source;
    if(!ctx||!source||source.filename!==this.selected||this.busy||!this.action)return;
    const chosen=source.binds.find(b=>id(b)===this.input);
    const current=source.binds.find(b=>b.action===this.action&&b.slot===this.slot);
    if(!chosen||chosen.slot==="axis"||(current&&!this.confirmReplacement))return;
    if(!window.confirm(`Créer un NOUVEAU profil pour Elite Dangerous ?\n\n${localizedActionLabel(ctx.meta,this.action)} (${this.slot}) → ${chosen.device} · ${chosen.key}\n\nFerme le jeu et son lanceur. Le profil original sera conservé.`))return;
    this.busy=true;this.repaint();
    try{
      const out=await controlsSavePreset(source.filename,{
        action:this.action,slot:this.slot,device:chosen.device,key:chosen.key,
        modifiers:chosen.modifiers,replaceExisting:Boolean(current&&this.confirmReplacement),
      });
      this.message=`Profil ${out.preset} créé : ${out.path}. Redémarre Elite Dangerous et sélectionne ${out.preset} dans Options → Commandes → Préréglages.`;
      await ctx.reload();
    }catch(e){this.message=`Création refusée : ${String(e)}`;}finally{this.busy=false;this.repaint();}
  }
}
