/** EDCH v1.6.8 — three physical X52 Pro modes: planning and optional selector calibration.
 * This panel NEVER switches Elite presets, never writes game files or synthesizes inputs.
 */
import type { Bind, BindsMeta } from "../../features/controls/binds.js";
import { buildX52ModePlans, renderX52ModesHtml, x52ModeDialCandidates, type X52ModeId } from "../../features/controls/x52ModeProfiles.js";
import { hotasCapture, hotasDevices, isRemote, isTauri, saveHtmlReport } from "../../platform/bridge.js";
import { h } from "../../ui/dom.js";

export class X52ModesPanel {
  private host?: HTMLElement;
  private ctx?: {meta:BindsMeta; actions:string[]; binds:Bind[]; source:string; onSelect:(mode:X52ModeId)=>void};
  private calibration: Partial<Record<X52ModeId,number>> = {};
  private captureBusy=false;
  private reportBusy=false;
  private message="";
  private inspected=false;
  private deviceId="";

  render(meta:BindsMeta, actions:string[], binds:Bind[], source:string, onSelect:(mode:X52ModeId)=>void):HTMLElement {
    this.ctx={meta,actions,binds,source,onSelect};
    const plans=buildX52ModePlans(actions,binds,meta);
    const btn=(title:string,call:()=>void,disabled=false)=>h("button.edch-c166-btn",{type:"button",disabled,onclick:call},title);
    const enabled=isTauri()&&!isRemote();
    const cards=plans.map(plan=>h("article.edch-x52-mode-card",null,
      h("div.edch-x52-mode-header",null,h("span.edch-x52-mode-number",null,`MODE ${plan.id}`),h("strong",null,plan.title)),
      h("p.edch-c166-muted",null,plan.purpose),
      h("p",null,`${plan.assigned}/${plan.rows.length} commandes déjà attribuées · ${plan.suggested} suggestion(s) prudente(s).`),
      h("div.edch-x52-mode-actions",null,
        btn("Préparer ce mode",()=>this.ctx?.onSelect(plan.id),!actions.length),
        btn(this.captureBusy?"Capture…":"Tester la molette",()=>{void this.captureMode(plan.id);},!enabled||this.captureBusy||this.reportBusy||!actions.length)),
      this.calibration[plan.id]===undefined
        ? h("p.edch-c166-muted",null,"Sélecteur physique : non étalonné")
        : h("p.edch-c166-muted",null,`Position ${plan.id} capturée : bouton Linux n° ${this.calibration[plan.id]}. Vérifier la correspondance Proton/Elite. ${x52ModeDialCandidates(this.calibration[plan.id]!,binds).join(" / ")||"Aucun Joy_N observé dans ce profil"}.`),
      h("details.edch-x52-mode-details",null,h("summary",null,`Consulter les commandes (${plan.rows.length})`),
        h("div.edch-x52-mode-rows",null,...plan.rows.map(row=>h("div.edch-x52-mode-row",null,
          h("strong",null,row.label),h("code",null,row.action),
          h("small",null,row.current.join(" · ")||"Non affectée"))))),
    ));
    this.host=h("section.card.edch-x52-modes-v168",null,
      h("header",null,h("p.edch-c166-eyebrow",null,"X52 PROFESSIONAL · SÉLECTEUR PHYSIQUE"),
        h("h3",null,"Profils des trois modes · v1.6.8")),
      h("p.edch-c166-muted",null,"Mode 1 : Pilotage/Navigation · Mode 2 : Combat · Mode 3 : Exploration/BGS. Les boutons et commandes affichés proviennent du profil source ; aucun axe analogique n'est modifié."),
      h("div.edch-x52-mode-grid",null,...cards),
      h("div.edch-x52-mode-footer",null,
        btn(this.reportBusy?"Enregistrement…":"Enregistrer les 3 fiches en HTML",()=>{void this.saveReport();},this.reportBusy||!actions.length),
        this.inspected&&this.deviceId ? h("span.edch-c166-muted",null,`Capture possible : ${this.deviceId}`) : null),
      this.message?h("p.edch-x52-mode-message",{role:"status"},this.message):null,
      h("p.edch-c166-muted",null,"Les profils du jeu ne suivent pas automatiquement la rotation du sélecteur. Un mode sélectionné prépare un brouillon ; il faut valider le nouveau .binds dans Commandes puis le choisir manuellement dans Elite Dangerous. Un changement automatique nécessitera un remappage compatible et une validation matérielle."),
      h("p.edch-c166-credits",null,"X52 Pro : trois modes matériels (éventuellement Pinkie avec le logiciel approprié). Crédits EDCH : CMDR MDLuffy · Cyberpunk Philou."));
    return this.host;
  }
  private repaint(){const c=this.ctx;if(this.host?.isConnected&&c)this.host.replaceWith(this.render(c.meta,c.actions,c.binds,c.source,c.onSelect));}
  private async scan():Promise<string> {
    this.inspected=true;
    const list=await hotasDevices();
    const found=list.find(x=>x.readable&&/x52|saitek/i.test(x.name));
    if(!found)throw new Error("Aucun Logitech/Saitek X52 Pro lisible détecté. Vérifier /dev/input/js0 et HOTAS Studio.");
    this.deviceId=found.id;
    return found.id;
  }
  private async captureMode(mode:X52ModeId):Promise<void>{
    if(this.captureBusy||!isTauri()||isRemote())return;
    this.captureBusy=true;
    this.message=`Mode ${mode} : place d'abord la molette sur une AUTRE position, clique puis tourne vers Mode ${mode} avant 10 secondes.`;
    this.repaint();
    try {
      const device=this.deviceId||await this.scan();
      const event=await hotasCapture(device,"button",10_000);
      if(event.kind!=="button" || !Number.isInteger(event.inputIndex)) throw new Error("Événement de molette non reconnu");
      this.calibration[mode]=event.inputIndex;
      const others=(Object.entries(this.calibration) as [string,number][]).filter(([m])=>Number(m)!==mode);
      this.message=others.some(([,v])=>v===event.inputIndex)
        ? `Mode ${mode} : index ${event.inputIndex} déjà relevé pour une autre position. Recommence : ce n'est pas une calibration fiable.`
        : `Mode ${mode} : bouton Linux ${event.inputIndex} observé. Ce numéro n'est pas encore un identifiant Elite Dangerous confirmé.`;
    } catch (e) {this.message=`Étalonnage du mode ${mode} impossible : ${String((e as Error)?.message ?? e)}`;}
    finally{this.captureBusy=false;this.repaint();}
  }
  private async saveReport():Promise<void>{
    if(this.reportBusy||!this.ctx)return;
    this.reportBusy=true;this.repaint();
    try {
      const c=this.ctx;
      const html=renderX52ModesHtml(buildX52ModePlans(c.actions,c.binds,c.meta),c.source,this.calibration);
      if(isTauri()&&!isRemote()) {
        const path=await saveHtmlReport("commandes",html);
        this.message=`Guide des trois modes enregistré : ${path}`;
      }else{
        const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
        try {
          const a=document.createElement("a");a.href=url;a.download="EDCH-X52Pro-3-modes.html";document.body.appendChild(a);a.click();a.remove();
        }finally{window.setTimeout(()=>URL.revokeObjectURL(url),30_000);}
        this.message="Téléchargement du guide HTML demandé au navigateur.";
      }
    }catch(e){this.message=`Export impossible : ${String((e as Error)?.message ?? e)}`;}
    finally{this.reportBusy=false;this.repaint();}
  }
}
