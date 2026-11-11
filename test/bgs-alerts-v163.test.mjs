import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeAlertPriorities,
  selectAlertPage,
  DEFAULT_ALERT_QUERY,
} from "../dist/js/features/bgs/alertView.js";

const row = (id, severity = "info") => ({
  id: String(id), kind: "stale", severity, system: `Système ${id}`,
  text: `Observation ${id}`, observedChange: false,
});

test("v1.6.3: 306 follow-ups do not become 306 urgent alerts", () => {
  const rows = Array.from({ length: 306 }, (_, i) => row(i));
  assert.deepEqual(summarizeAlertPriorities(rows), { total: 306, critical: 0, warning: 0, info: 306 });
  assert.equal(selectAlertPage(rows, { ...DEFAULT_ALERT_QUERY, severity: "critical" }).total, 0);
});

test("v1.6.3: priority breakdown matches unmuted alerts and does not mutate data", () => {
  const rows = [row(1, "critical"), row(2, "warning"), row(3), row(4)];
  const original = JSON.stringify(rows);
  assert.deepEqual(summarizeAlertPriorities(rows), { total: 4, critical: 1, warning: 1, info: 2 });
  assert.deepEqual(summarizeAlertPriorities(rows.filter(x => x.id !== "1")), { total: 3, critical: 0, warning: 1, info: 2 });
  assert.equal(JSON.stringify(rows), original);
});

test("v1.6.3: empty, mixed, and filtered alert collections have consistent totals", () => {
  assert.deepEqual(summarizeAlertPriorities([]), { total: 0, critical: 0, warning: 0, info: 0 });
  const rows = [row(1, "warning"), row(2, "info"), row(3, "critical")];
  const selection = selectAlertPage(rows, { ...DEFAULT_ALERT_QUERY, severity: "warning" });
  assert.deepEqual(summarizeAlertPriorities(selection.filtered), { total: 1, critical: 0, warning: 1, info: 0 });
});

test("v1.6.3: dashboard distinguishes trend alerts from all BGS observations", () => {
  const src = readFileSync(new URL("../src/views/bgs/index.ts", import.meta.url), "utf8");
  assert.match(src, /\["Variations récentes à vérifier", alerts\.length\]/);
  assert.doesNotMatch(src, /\["Alertes à vérifier", alerts\.length\]/);
});

test("v1.6.3: overview keeps original BGS rules and reset is session-only", () => {
  const src = readFileSync(new URL("../src/features/bgs/alertPanel.ts", import.meta.url), "utf8");
  assert.match(src, /v1\.6\.3/);
  assert.match(src, /summarizeAlertPriorities\(visible\)/);
  assert.match(src, /Réinitialiser recherche et filtres/);
  assert.match(src, /viewCache\.set\(viewKey, \{ \.\.\.DEFAULT_ALERT_QUERY \}\)/);
  assert.match(src, /Variations récentes à vérifier/);
});
