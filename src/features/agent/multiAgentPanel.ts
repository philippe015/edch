/** EDCH-COG-MULTI-v1.6.0 — read-only local audit display. */
import { h } from "../../ui/dom.js";
import { agentDiagnosticSummary, agentWorkerHealth, requestMultiAgentDiagnostic } from "./runtime.js";

interface AuditCounts { observed: number; proposed: number; verified: number; rejected: number }
const totals: AuditCounts = { observed: 0, proposed: 0, verified: 0, rejected: 0 };
let panel: HTMLElement | null = null;
let listenersReady = false;
// The runtime owns Worker state; a previous positive diagnostic must never be cached here.
let lastAt = "";

function render(): void {
  if (!panel?.isConnected) return;
  const status = panel.querySelector<HTMLElement>("#edch-cog-v160-status");
  const counters = panel.querySelector<HTMLElement>("#edch-cog-v160-stats");
  const state = agentWorkerHealth();
  if (status) status.textContent = state.phase === "ready"
    ? "Worker vérifié · trois rôles locaux prêts"
    : state.phase === "paused" ? "Traitement suspendu : consulte le diagnostic et relance manuellement"
    : state.phase === "retry" ? "Worker en reprise automatique (diagnostic précédent invalidé)"
    : state.phase === "starting" ? "Worker démarré, diagnostic de coordination non confirmé"
    : "Worker arrêté · aucun rôle opérationnel";
  if (counters) counters.textContent =
    `Observés : ${totals.observed} · Proposés : ${totals.proposed} · Vérifiés : ${totals.verified}` +
    ` · Refusés : ${totals.rejected}${lastAt ? ` · Dernier traitement : ${lastAt}` : ""}`;
}

function listeners(): void {
  if (listenersReady) return;
  listenersReady = true;
  window.addEventListener("edch-cog-audit", (event: Event) => {
    const payload = (event as CustomEvent<unknown>).detail;
    if (!payload || typeof payload !== "object") return;
    const item = payload as Record<string, unknown>;
    if (!["observed", "proposed", "verified", "rejected"].every(
      (key) => Number.isSafeInteger(item[key]) && (item[key] as number) >= 0 && (item[key] as number) <= 32,
    )) return;
    const observed = item.observed as number, proposed = item.proposed as number;
    const verified = item.verified as number, rejected = item.rejected as number;
    if (verified > proposed || proposed > observed || rejected !== proposed - verified) return;
    totals.observed += observed;
    totals.proposed += proposed;
    totals.verified += verified;
    totals.rejected += rejected;
    lastAt = new Date().toLocaleTimeString("fr-FR");
    render();
  });
  window.addEventListener("edch-cog-worker-state", render);
  window.addEventListener("edch-cog-capabilities", render);
}

/** Mount inside the existing Agent COG tab, without attaching any journal reader. */
export function mountMultiAgentPanel(): HTMLElement {
  listeners();
  const node = h("section.card.bgs-panel.edch-cog-multi-v160", null,
    h("h2", null, "Agent COG · Coordination locale v1.6.0"),
    h("p.sub", null,
      "Observateur → Analyste à règles → Vérificateur indépendant. Seules les actions validées sont publiées ; aucune API Mistral, aucun contrôle du jeu."),
    h("div.bgs-actions", null,
      h("button", { type: "button", onclick: () => {
        if (!requestMultiAgentDiagnostic()) {
          const status = panel?.querySelector<HTMLElement>("#edch-cog-v160-status");
          if (status) status.textContent = "Active l'agent avant le diagnostic des trois rôles.";
        }
      } }, "Tester la coordination"),
    ),
    h("div.bgs-actions", null,
      h("button", { type: "button", onclick: () => {
        const report = panel?.querySelector<HTMLElement>("#edch-cog-v161-diagnostic");
        if (report) report.textContent = agentDiagnosticSummary();
      } }, "Diagnostic local"),
    ),
    h("pre#edch-cog-v161-diagnostic.sub", { role: "status" }, "Diagnostic à la demande : aucun secret collecté."),
    h("p#edch-cog-v160-status.sub", { role: "status" }, "Vérification du Worker en attente"),
    h("p#edch-cog-v160-stats.sub", null, "Aucun événement traité depuis l'ouverture de l'application."),
    h("p.sub", null,
      "Compteurs de cette session, non persistants. La file durable et la mémoire SQLite restent gérées par les versions précédentes. Le vérificateur rejette les propositions qui ne correspondent pas au journal."),
  );
  panel = node;
  // Pane is attached by the workspace after this call; update once mounted.
  window.requestAnimationFrame(render);
  return node;
}
