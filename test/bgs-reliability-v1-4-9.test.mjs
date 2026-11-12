// EDCH-BGS-RELIABILITY-v1.4.9
import test from "node:test";
import assert from "node:assert/strict";
import { verifyBgsSnapshot, verifyBgsPdf, diagnoseBgsReliability } from "../dist/js/features/bgs/reliability.js";

const sample = (systems = 1) => ({
  faction: "1ER ASTRA MILITARUM",
  systems: Array.from({ length: systems }, (_, i) => ({
    name: `Système ${i}`,
    states: [],
    source: "manual",
    retrievedAt: "2026-11-08T12:00:00Z",
  })),
  history: [],
});

test("reliability v1.4.9: snapshot JSON round-trips without mutation", () => {
  const data = sample(2);
  const before = JSON.stringify(data);
  const report = verifyBgsSnapshot(data);
  assert.equal(report.systems, 2);
  assert.deepEqual(JSON.parse(report.json), data);
  assert.equal(JSON.stringify(data), before);
});

test("reliability v1.4.9: refus malformed and oversized snapshots", () => {
  assert.throws(() => verifyBgsSnapshot({ faction: "", systems: [], history: [] }));
  assert.throws(() => verifyBgsSnapshot({ faction: "test", systems: {}, history: [] }));
  assert.throws(() => verifyBgsSnapshot(sample(5001)));
});

test("reliability v1.4.9: true PDF and page count", () => {
  const report = diagnoseBgsReliability(sample(205), "PHILOU");
  assert.ok(report.pdf.pages > 1);
  assert.ok(report.pdf.bytes > 500);
  assert.match(report.message, /Contrôle OK/);
});

test("reliability v1.4.9: reject HTML masquerading as PDF", () => {
  assert.throws(() => verifyBgsPdf(new TextEncoder().encode("<html>not a PDF</html>")));
});
