// EDCH-BGS-PDF-v1.4.3: real PDF regression tests, no browser or external dependency.
import test from "node:test";
import assert from "node:assert/strict";
import { buildBgsReportPdf } from "../dist/js/features/bgs/reportPdf.js";

const sample = (count) => ({
  faction: "1ER ASTRA MILITARUM",
  systems: Array.from({ length: count }, (_, i) => ({
    name: i === 4 ? "Étoile avec parenthèses (et barre \\) - " + "É".repeat(80) : `Système ${i + 1}`,
    influence: i % 3 ? undefined : 47.5,
    controls: i % 2 === 0,
    states: ["Boom"],
    source: "Spansh",
    retrievedAt: "2026-11-08T08:00:00.000Z",
    updatedAt: "2026-11-08T07:00:00.000Z",
    note: i === 4 ? "Information\nmultiligne" : undefined,
  })),
  history: [],
  partial: true,
  reportedTotal: 450,
});

const view = (bytes) => new TextDecoder().decode(bytes);

test("BGS PDF: vrai fichier PDF avec une page même sans systèmes", () => {
  const text = view(buildBgsReportPdf(sample(0), { commander: "PHILOU" }));
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type \/Page /);
  assert.match(text, /\/Count 1/);
  assert.match(text, /%%EOF\s*$/);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
});

test("BGS PDF: tous les systèmes sont contenus dans plusieurs pages", () => {
  const bytes = buildBgsReportPdf(sample(250), { commander: "PHILOU" });
  const text = view(bytes);
  const pageCount = Number(text.match(/\/Count (\d+)/)?.[1]);
  assert.ok(pageCount > 1, "la pagination doit fonctionner");
  assert.match(text, /Syst\\350me 250/); // Système 250 en encodage WinAnsi PDF octal
  assert.match(text, /PHILOU/);
  assert.match(text, /PARTIELLE/);
  assert.match(text, /Page 1 \/ /);
  assert.match(text, /%%EOF\s*$/);
});

test("BGS PDF: caractères spéciaux échappés, pas de code actif", () => {
  const data = sample(2);
  data.faction = "Faction (alpha) \\ test";
  data.systems[0].name = "Étoile (alpha) \\ test";
  const text = view(buildBgsReportPdf(data));
  assert.ok(text.includes(String.raw`Faction \(alpha\) \\ test`));
  assert.ok(text.includes(String.raw`\311toile \(alpha\) \\`));
  assert.doesNotMatch(text, /\/JavaScript|\/OpenAction|\/Launch/);
});

test("BGS PDF: données invalides ou énormes rejetées", () => {
  assert.throws(() => buildBgsReportPdf({ systems: [], history: null }));
  assert.throws(() => buildBgsReportPdf(sample(5001)), /Trop de systèmes/);
});
