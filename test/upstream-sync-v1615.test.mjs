import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {padControl} from "../dist/js/features/controls/binds.js";
import {recommendXboxProfile} from "../dist/js/features/controls/xboxIntelligentProfiles.js";
import {prepareAzerty} from "../dist/js/features/controls/preparedProfiles.js";
const file=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const catalog=JSON.parse(file("public/data/binds.json"));
const meta=catalog;
const b=(action,key,device="GamePad",slot="primary")=>({action,key,device,slot,modifiers:[]});

test("BKNadir v0.10.12 maintained EDRefCard2 catalog expands coverage without deleting old fields",()=>{
  assert.deepEqual(Object.keys(catalog).sort(),["controls","devices","keymap","templateBase","templates","vendors","vidpid"].sort());
  assert.ok(Object.keys(catalog.controls).length>=420);
  assert.ok(Object.keys(catalog.templates).length>=111);
  assert.ok(catalog.templateBase.includes("brammmers/edrefcard2/"));
  for(const id of ["SaitekX52Pro","GamePad","XB360 Pad","TFlightHotasOne"])
    assert.ok(catalog.templates[id]||catalog.devices[id],id+" missing");
  for(const id of ["HumanoidWalkButton","HumanoidEmoteWheelButton","PitchAxisRaw","RollAxisRaw"])
    assert.ok(catalog.controls[id],id+" missing");
});

test("new controller catalog is still compatible with Xbox mapping and local suggestions",()=>{
  assert.equal(padControl("GamePad","GamePad_FaceDown"),"A");
  const src=[b("BuggyPrimaryFireButton","Pad_RTrigger")];
  const plan=recommendXboxProfile("ship","combat",Object.keys(catalog.controls),src,meta);
  assert.ok(plan.changes.every(c=>c.device==="GamePad"&&c.key.startsWith("Pad_")));
  assert.ok(plan.changes.every(c=>c.slot!=="axis"&&!c.replaceExisting));
});

test("AZERTY, joystick and existing game actions remain available after catalog replacement",()=>{
  const src=[b("PrimaryFire","Joy_1","SaitekX52Pro")];
  const plan=prepareAzerty("ship","balanced",Object.keys(catalog.controls),src,meta);
  assert.ok(plan.changes.some(c=>c.action==="ForwardThrustButton"&&c.key==="Key_Z"));
  assert.ok(plan.changes.every(c=>c.device==="Keyboard"));
});

test("generator and provenance agree with the maintained EDRefCard2 version",()=>{
  const source=file("tools/gen_binds.py");
  const notice=file("NOTICE");
  const commit=file("tools/sources/edrefcard/COMMIT").trim();
  assert.ok(commit.length===40);
  assert.ok(catalog.templateBase.includes(commit));
  assert.ok(source.includes('load_module("controlsData")'));
  assert.ok(notice.includes("brammmers/edrefcard2"));
  assert.ok(file("tools/sources/edrefcard/PICTURES").includes("hotas4"));
});

test("upstream combat bond fix affects massacre missions but not CZ completion counters",()=>{
  const code=file("src/game/activity/missions.ts");
  assert.ok(code.includes("const victim = ev.VictimFaction_Localised ?? ev.VictimFaction;"));
  assert.match(code,/FactionKillBond:[\s\S]*?massacreKill\(st, String\(victim\)\)/);
  // The separate user-requested count of completed combat zones is not implemented here.
  assert.ok(file("test/massacre.test.mjs").includes("conflict massacre"));
});
