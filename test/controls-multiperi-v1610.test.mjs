import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GAME_SCOPES, INPUT_FAMILIES, USAGE_STYLES, detectedInputs,
  inputFamilyMatches, recommendScopedProfile, scopeForGroup, scopedInputWarnings,
} from "../dist/js/features/controls/scopedProfiles.js";

const meta = {
  controls: {
    PrimaryFire:{g:"Ship",n:"Tir principal"},SecondaryFire:{g:"Ship",n:"Tir secondaire"},
    SelectTarget:{g:"Ship",n:"Cibler"},HyperSuperCombination:{g:"Ship",n:"Saut FSD"},
    BuggyPrimaryFireButton:{g:"SRV",n:"Tir VRS"},
    BuggySecondaryFireButton:{g:"SRV",n:"Tir secondaire VRS"},
    ToggleBuggyTurretButton:{g:"SRV",n:"Tourelle"},
    HumanoidPrimaryFireButton:{g:"OnFoot",n:"Tir"},
    HumanoidJumpButton:{g:"OnFoot",n:"Saut"},
    HumanoidPrimaryInteractButton:{g:"OnFoot",n:"Interaction"},
    HumanoidReloadButton:{g:"OnFoot",n:"Recharger"},
    GalaxyMapOpen:{g:"Galaxy map",n:"Carte galactique"},
  },
  devices:{
    SaitekX52Pro:{kind:"joystick",label:"X52 Pro"},
    GamePad:{kind:"gamepad",label:"Manette Xbox"},
    Keyboard:{kind:"keyboard",label:"Clavier"},
  },
  templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{},
};
const b=(action,device,key,slot="primary",modifiers=[])=>({action,device,key,slot,modifiers});

test("three game tabs, three input families and four advice styles",()=>{
  assert.deepEqual(GAME_SCOPES.map(x=>x.id),["ship","srv","foot"]);
  assert.deepEqual(INPUT_FAMILIES.map(x=>x.id),["azerty","hotas","xbox"]);
  assert.deepEqual(USAGE_STYLES.map(x=>x.id),["balanced","navigation","combat","exploration"]);
  assert.equal(scopeForGroup("Ship"),"ship");
  assert.equal(scopeForGroup("SRV"),"srv");
  assert.equal(scopeForGroup("OnFoot"),"foot");
  assert.equal(scopeForGroup("Galaxy map"),null);
});

test("Xbox, HOTAS and keyboard are not mixed up",()=>{
  const inputs=[
    b("PrimaryFire","SaitekX52Pro","Joy_1"),
    b("HumanoidPrimaryFireButton","GamePad","Pad_RTrigger"),
    b("HumanoidJumpButton","Keyboard","Key_Space"),
  ];
  assert.deepEqual(detectedInputs(inputs,"hotas",meta).map(x=>x.key),["Joy_1"]);
  assert.deepEqual(detectedInputs(inputs,"xbox",meta).map(x=>x.key),["Pad_RTrigger"]);
  assert.deepEqual(detectedInputs(inputs,"azerty",meta).map(x=>x.key),["Key_Space"]);
  assert.equal(inputFamilyMatches(inputs[0],"xbox",meta),false);
});

test("VRS may borrow an actual X52 trigger from ship profile, never invent Joy_N",()=>{
  const bindings=[b("PrimaryFire","SaitekX52Pro","Joy_1")];
  const input=JSON.stringify(bindings);
  const proposal=recommendScopedProfile("srv","hotas","combat",
    ["PrimaryFire","BuggyPrimaryFireButton","BuggySecondaryFireButton"],bindings,meta);
  assert.deepEqual(proposal.changes,[{
    action:"BuggyPrimaryFireButton",slot:"primary",device:"SaitekX52Pro",key:"Joy_1",
    modifiers:[],replaceExisting:false,
  }]);
  assert.equal(JSON.stringify(bindings),input);
});

test("Xbox copy to ship uses the exact source button, not an assumed XInput index",()=>{
  const bindings=[b("BuggyPrimaryFireButton","GamePad","Pad_RTrigger")];
  const p=recommendScopedProfile("ship","xbox","combat",
    ["PrimaryFire","SecondaryFire"],bindings,meta);
  assert.equal(p.changes[0]?.action,"PrimaryFire");
  assert.equal(p.changes[0]?.key,"Pad_RTrigger");
  assert.equal(p.changes.length,1);
});

test("repeated input in same context is excluded",()=>{
  const bindings=[
    b("PrimaryFire","SaitekX52Pro","Joy_1"),
    b("BuggySecondaryFireButton","SaitekX52Pro","Joy_1"),
  ];
  const p=recommendScopedProfile("srv","hotas","combat",
    ["BuggyPrimaryFireButton","BuggySecondaryFireButton"],bindings,meta);
  assert.equal(p.changes.length,0);
  assert.equal(p.covered,1);
});

test("occupied mouse slot is preserved; free secondary is staged",()=>{
  const bindings=[
    b("BuggyPrimaryFireButton","GamePad","Pad_RTrigger"),
    b("PrimaryFire","Mouse","Mouse_1"),
  ];
  const p=recommendScopedProfile("ship","xbox","combat",["PrimaryFire"],bindings,meta);
  assert.equal(p.changes.length,1);
  assert.equal(p.changes[0].slot,"secondary");
  assert.equal(p.changes[0].replaceExisting,false);
});

test("AZERTY suggestions require keys already present in the source file",()=>{
  const empty=recommendScopedProfile("ship","azerty","balanced",
    ["HyperSuperCombination"],[],meta);
  assert.equal(empty.changes.length,0);
  const source=[b("BuggyPrimaryFireButton","Keyboard","Key_J")];
  const populated=recommendScopedProfile("ship","azerty","balanced",
    ["HyperSuperCombination"],source,meta);
  assert.equal(populated.changes[0]?.key,"Key_J");
  assert.equal(populated.changes[0]?.action,"HyperSuperCombination");
});

test("already assigned family slots remain untouched; unknown actions produce no fabricated inputs",()=>{
  const source=[b("PrimaryFire","SaitekX52Pro","Joy_1")];
  const p=recommendScopedProfile("ship","hotas","combat",
    ["PrimaryFire","SecondaryFire"],source,meta);
  assert.equal(p.covered,1);
  assert.equal(p.changes.length,0);
  const missing=recommendScopedProfile("srv","xbox","balanced",["SomethingElse"],source,meta);
  assert.equal(missing.changes.length,0);
  assert.ok(missing.warnings.some(x=>x.includes("Aucun bouton")));
});

test("UI contract: three top level tabs, input family switch, advanced tools preserved",()=>{
  const main=readFileSync(new URL("../src/views/controls/index.ts",import.meta.url),"utf8");
  const editor=readFileSync(new URL("../src/views/controls/presetEditor.ts",import.meta.url),"utf8");
  for(const label of ["Vaisseau","SRV / VRS","À pied"]) assert.ok(main.includes(label));
  assert.ok(main.includes("this.presetEditor.hasDraft()"));
  assert.ok(main.includes("details.controls-advanced"));
  assert.ok(main.includes("this.commandesPro.render"));
  assert.ok(main.includes("this.backupCard()"));
  assert.ok(main.includes("this.onFootEditor.render"));
  assert.ok(editor.includes("recommendScopedProfile"));
  assert.ok(editor.includes("INPUT_FAMILIES"));
  assert.ok(editor.includes("Préparer les suggestions"));
  assert.ok(editor.includes("controlsSaveNamedPresetBatch"));
  assert.ok(editor.includes("window.confirm("));
});

test("cross-subgroup shortcuts are warned about, unrelated contexts are not",()=>{
  const extra={...meta,controls:{
    ...meta.controls,ScannerTrigger:{g:"Scanners",n:"Scanner"},
    UICancel:{g:"UI",n:"Annuler"},
  }};
  const existing=[b("ScannerTrigger","Keyboard","Key_J")];
  const sameContext=[{action:"HyperSuperCombination",slot:"primary",
    device:"Keyboard",key:"Key_J",modifiers:[],replaceExisting:false}];
  assert.equal(scopedInputWarnings(existing,sameContext,extra).length,1);
  const differentContext=[{...sameContext[0],action:"BuggyPrimaryFireButton"}];
  assert.deepEqual(scopedInputWarnings(existing,differentContext,extra),[]);
});
