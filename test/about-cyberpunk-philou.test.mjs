// Community edition attribution regression: preserve upstream authorship and localized wording.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("About page preserves original author and credits the BGS contributor", () => {
  const source = read("src/views/about/index.ts");
  assert.match(source, /"CMDR MDLuffy"/);
  assert.match(source, /"Cyberpunk Philou"/);
  assert.match(source, /t\("about\.communityContributorTitle"\)/);
  assert.match(source, /t\("about\.communityContributorDescription"\)/);
  assert.match(source, /section\.card\.about-community-contribution/);
});

test("Community contribution is translated in all six app languages", () => {
  for (const code of ["en", "fr", "de", "es", "pt", "ru"]) {
    const locale = JSON.parse(read(`public/locales/${code}.json`));
    assert.ok(locale.about.communityContributorTitle, code);
    assert.ok(locale.about.communityContributorDescription, code);
  }
  const fr = JSON.parse(read("public/locales/fr.json"));
  assert.match(fr.about.communityContributorDescription, /développement et au codage/);
  assert.match(fr.about.communityContributorDescription, /non officielles/);
});
