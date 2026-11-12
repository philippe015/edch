import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../src/views/bgs/index.ts", import.meta.url), "utf8");
test("BGS shows active missions from actual EDCH journal activity state",()=>{
 assert.match(src,/Object\.values\(this\.ctx\.store\.state\.activity\.missions\)/);
 assert.match(src,/Missions actives · Odyssey \/ au sol inclus/);
});
test("BGS does not turn active missions into completed BGS activities",()=>{
 assert.match(src,/Une mission n'est terminée que lorsque le journal émet MissionCompleted/);
 assert.match(src,/Les missions achevées avant le lancement d'EDCH ne sont pas ajoutées rétroactivement/);
});
test("Ground type unknown is shown, not invented",()=>{
 assert.match(src,/"Non précisé"/);
 assert.match(src,/m\.faction \|\| "Non indiquée par le journal"/);
});
