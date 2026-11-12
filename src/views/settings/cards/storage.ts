/** Cyberpunk Philou v1.6.11: storage and backup status, strictly local and read-only. */
import { clipboardWrite, isRemote, isTauri, storageDiagnostic, type StorageDiagnostic, type StorageEntry } from "../../../platform/bridge.js";
import { sqliteHealth } from "../../../features/bgs/sqlite.js";
import { readableBytes, storageTotal } from "../../../features/storage/size.js";
import { h } from "../../../ui/dom.js";

const humanDate = (unix: number | null): string =>
  unix === null ? "Non disponible" : new Date(unix * 1000).toLocaleString("fr-FR");

export class StorageCard {
  private host?: HTMLElement;
  private report?: StorageDiagnostic;
  private checking = false;
  private sqliteChecking = false;
  private error = "";
  private sqliteResult = "";

  render(): HTMLElement {
    const enabled = isTauri() && !isRemote();
    const rows = this.report?.entries ?? [];
    const total = this.report ? storageTotal(this.report.entries) : null;
    const item = (entry: StorageEntry) => h("div.edch-storage-row", null,
      h("div.edch-storage-info", null,
        h("strong", null, entry.label),
        h("code", { title: entry.path }, entry.path),
        h("small", null,
          !entry.exists ? "Absent : aucun stockage détecté" :
          entry.incomplete ? `${entry.files} fichier(s) · Analyse incomplète (accès limité ou limite de sécurité)` :
          `${entry.files} fichier(s)`,
        ),
      ),
      h("div.edch-storage-amount", null,
        h("strong", null, !entry.exists ? "—" : readableBytes(entry.bytes)),
        entry.exists ? h("button.ghost.small", {
          type: "button", onclick: () => { void clipboardWrite(entry.path).then(
            () => this.setStatus("Chemin copié : " + entry.label),
            e => this.setStatus("Copie impossible : " + String(e)),
          ); },
        }, "Copier chemin") : null,
      ),
    );
    const files = (this.report?.dataFiles ?? []).map(f => h("div.edch-storage-data", null,
      h("strong", null, f.name),
      h("span", null, f.exists ? `Présente · ${readableBytes(f.bytes)}` : "Non créée"),
      f.modifiedUnix !== null && f.exists
        ? h("small", null, "Dernière modification : " + humanDate(f.modifiedUnix)) : null,
    ));
    this.host = h("section.card.edch-storage-v1611", { "data-tab":"advanced" },
      h("h3", null, "Stockage et sauvegardes · Cyberpunk Philou"),
      h("p.sub", null,
        "Où se trouvent les données de l'application ? Analyse en lecture seule, limitée aux dossiers connus. Aucun fichier n'est supprimé."),
      h("div.row", null,
        h("button.primary", {
          type: "button", disabled:!enabled||this.checking,
          onclick:()=>{void this.refresh();},
        }, this.checking ? "Analyse du stockage…" : this.report ? "Actualiser l'analyse" : "Analyser mon stockage"),
        h("button.ghost", {
          type:"button", disabled:!enabled||this.sqliteChecking,
          onclick:()=>{void this.checkSqlite();},
        }, this.sqliteChecking ? "Vérification…" : "Tester l'intégrité BGS SQLite"),
      ),
      !enabled ? h("p.sub", null, "Diagnostic disponible uniquement sur le PC, pas à distance.") : null,
      this.error ? h("p",{role:"alert",class:"notice"},this.error) : null,
      this.sqliteResult ? h("p",{role:"status",class:"notice"},this.sqliteResult) : null,
      this.report ? h("div",null,
        h("p.edch-storage-total",null,
          h("strong",null,"Stockage identifié : "),
          total === null ? "Total partiel (analyse incomplète)" : readableBytes(total),
        ),
        h("p.sub",null,"Mesure locale, sans les dossiers complets du jeu ni les bibliothèques système."),
        h("div.edch-storage-rows",null,...rows.map(item)),
        h("h4",null,"État des données BGS"),
        h("div.edch-storage-datafiles",null,...files),
        h("p.sub",null,`Sauvegardes SQLite des agents : ${this.report.agentBackups} fichier(s).`,
          this.report.latestAgentBackupUnix === null ? "" :
            " Dernière : " + humanDate(this.report.latestAgentBackupUnix)),
        h("p.sub",null,
          "La présence d'un fichier n'est pas une preuve d'intégrité. Utilise « Tester l'intégrité BGS SQLite » pour contrôler la base principale ; les sauvegardes des agents doivent être vérifiées avant restauration."),
        h("small",null,"Relevé : "+humanDate(this.report.checkedUnix)),
      ) : h("p.sub",null,"Clique sur « Analyser mon stockage » pour connaître les tailles et emplacements exacts."),
    );
    return this.host;
  }

  private repaint(): void {
    if(this.host?.isConnected) this.host.replaceWith(this.render());
  }
  private setStatus(message:string):void { this.error=message;this.repaint(); }

  private async refresh():Promise<void> {
    if(this.checking || !isTauri() || isRemote()) return;
    this.checking=true;this.error="";this.repaint();
    try { this.report=await storageDiagnostic(); }
    catch(e) { this.error="Lecture du stockage impossible : "+String(e); }
    finally { this.checking=false;this.repaint(); }
  }
  private async checkSqlite():Promise<void> {
    if(this.sqliteChecking || !isTauri() || isRemote()) return;
    this.sqliteChecking=true;this.sqliteResult="";this.repaint();
    try {
      const result=await sqliteHealth();
      this.sqliteResult=result==="ok"?"Base BGS SQLite : intégrité vérifiée (quick_check = ok).":
        "Base BGS SQLite : résultat à examiner ("+result+").";
    } catch(e) { this.sqliteResult="Contrôle SQLite impossible : "+String(e); }
    finally { this.sqliteChecking=false;this.repaint(); }
  }
}
