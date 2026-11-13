import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  XBOX_CONTROLS, XBOX_STYLES, isXboxDevice, xboxControl, xboxAssignments,
  xboxUnrecognized, recommendXboxProfile,
} from "../dist/js/features/controls/xboxIntelligentProfiles.js";
import {isStagedAssignmentValid, bindingKey} from "../dist/js/features/controls/presetAdvisor.js";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const md={controls:{
  PrimaryFire:{g:"Ship",n:"Tir 1"},SecondaryFire:{g:"Ship",n:"Tir 2"},
  SelectTarget:{g:"Ship",n:"Cibler"},HyperSuperCombination:{g:"Ship",n:"Saut FSD"},
  LandingGearToggle:{g:"Ship",n:"Train"},UseBoostJuice:{g:"Ship",n:"Boost"},
  DeployHardpointToggle:{g:"Ship",n:"Armes"},
  BuggyPrimaryFireButton:{g:"SRV",n:"Tir VRS"},
  BuggySecondaryFireButton:{g:"SRV",n:"Tir VRS secondaire"},
  SelectTarget_Buggy:{g:"SRV",n:"Cibler VRS"},
  AutoBreakBuggyButton:{g:"SRV",n:"Frein VRS"},
  ToggleBuggyTurretButton:{g:"SRV",n:"Tourelle"},
  HeadlightsBuggyButton:{g:"SRV",n:"Lumières"},
  HumanoidPrimaryFireButton:{g:"OnFoot",n:"Tir à pied"},
  HumanoidJumpButton:{g:"OnFoot",n:"Saut à pied"},
  HumanoidReloadButton:{g:"OnFoot",n:"Recharger"},
  HumanoidPrimaryInteractButton:{g:"OnFoot",n:"Interaction"},
  HumanoidCrouchButton:{g:"OnFoot",n:"Accroupir"},
  HumanoidSprintButton:{g:"OnFoot",n:"Courir"},
},devices:{
  GamePad:{kind:"gamepad",label:"Manette"},
  "XB360 Pad":{kind:"gamepad",label:"Manette Xbox 360"},
  DualShock4:{kind:"gamepad",label:"Sony DualShock 4"},
},templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{}};
const b=(action,key,slot="primary",device="GamePad",modifiers=[])=>
 ({action,key,slot,device,modifiers});
const changes=(action,key,device="GamePad",replaceExisting=false)=>
 ({action,key,slot:"primary",device,modifiers:[],replaceExisting});

test("all Xbox graphical buttons, sticks, axes and triggers are distinct",()=>{
  const ids=XBOX_CONTROLS.map(c=>c.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ["A","B","X","Y","LTrigger","RTrigger","LBumper","RBumper",
    "LThumb","RThumb","LStickX","LStickY","RStickX","RStickY",
    "DPadUp","DPadDown","DPadLeft","DPadRight","Back","Start","Guide"])
    assert.ok(ids.includes(id),id);
  assert.ok(XBOX_CONTROLS.every(c=>c.x>0&&c.x<100&&c.y>0&&c.y<100));
});

test("Xbox variants and Sony gamepad are handled without inventing IDs",()=>{
  assert.equal(isXboxDevice("GamePad",md),true);
  assert.equal(isXboxDevice("XB360 Pad",md),true);
  assert.equal(isXboxDevice("DualShock4",md),false);
  assert.equal(xboxControl("GamePad","GamePad_FaceDown",md),"A");
  assert.equal(xboxControl("XB360 Pad","Pad_RTrigger",md),"RTrigger");
  assert.equal(xboxControl("GamePad","Neg_Pad_LStickX",md),"LStickX");
  assert.equal(xboxControl("GamePad","Pad_AlienButton",md),null);
  assert.equal(xboxControl("DualShock4","Joy_1",md),null);
});

test("vector mapping shows assigned button and analog axis per context",()=>{
  const src=[b("PrimaryFire","Pad_RTrigger"),
    b("BuggyPrimaryFireButton","Pad_RTrigger"),
    b("HumanoidJumpButton","GamePad_FaceDown"),
    b("SelectTarget","Neg_Pad_LStickX","axis")];
  assert.deepEqual(xboxAssignments("RTrigger","ship",src,[],md).existing.map(x=>x.action),["PrimaryFire"]);
  assert.deepEqual(xboxAssignments("RTrigger","srv",src,[],md).existing.map(x=>x.action),["BuggyPrimaryFireButton"]);
  assert.equal(xboxAssignments("A","foot",src,[],md).existing[0].action,"HumanoidJumpButton");
  const axis=xboxAssignments("LStickX","ship",src,[],md).existing[0];
  assert.equal(axis.slot,"axis");
  assert.equal(axis.key,"Neg_Pad_LStickX");
});

test("draft appears and original overridden slot disappears only in preview",()=>{
  const src=[b("PrimaryFire","Pad_X")],original=JSON.stringify(src);
  const draft=[changes("PrimaryFire","Pad_RTrigger","GamePad",true)];
  const x=xboxAssignments("X","ship",src,draft,md);
  assert.equal(x.existing.length,0);
  const rt=xboxAssignments("RTrigger","ship",src,draft,md);
  assert.equal(rt.draft.length,1);
  assert.equal(rt.draft[0].status,"draft");
  assert.equal(JSON.stringify(src),original);
});

test("intelligent profiles reuse verified peer button first, without changing it",()=>{
  const src=[b("BuggyPrimaryFireButton","Pad_RTrigger"),
    b("HumanoidJumpButton","Pad_A"),b("PrimaryFire","Pad_X")];
  const before=JSON.stringify(src);
  const p=recommendXboxProfile("foot","combat",Object.keys(md.controls),src,md);
  const fire=p.suggestions.find(x=>x.assignment.action==="HumanoidPrimaryFireButton");
  assert.equal(fire?.assignment.key,"Pad_RTrigger");
  assert.equal(fire?.confidence,"cross-context");
  assert.ok(p.changes.every(c=>isStagedAssignmentValid(c,Object.keys(md.controls),src)));
  assert.equal(JSON.stringify(src),before);
});

test("known conventional controller button may be recommended only when free",()=>{
  const src=[b("BuggySecondaryFireButton","Pad_B"),b("HumanoidJumpButton","Pad_A")];
  const p=recommendXboxProfile("srv","balanced",Object.keys(md.controls),src,md);
  const brake=p.suggestions.find(x=>x.assignment.action==="AutoBreakBuggyButton");
  assert.equal(brake?.assignment.key,"Pad_B");
  assert.equal(brake?.confidence,"convention");
  const occupied=[...src,b("BuggyPrimaryFireButton","Pad_B")];
  const q=recommendXboxProfile("srv","balanced",Object.keys(md.controls),occupied,md);
  assert.equal(q.changes.some(x=>x.action==="AutoBreakBuggyButton"&&x.key==="Pad_B"),false);
});

test("no invented buttons, no axis modifications, no replacements, no multi-device mixing",()=>{
  const src=[
    b("BuggyPrimaryFireButton","Pad_RTrigger"),
    b("SelectTarget","Pad_A"),
    b("HumanoidJumpButton","Pad_X","primary","XB360 Pad"),
    b("PrimaryFire","Pad_LStickX","axis"),
    b("SecondaryFire","Pad_UnknownButton","primary"),
  ];
  for(const scope of ["ship","srv","foot"])
    for(const usage of Object.keys(XBOX_STYLES)){
      const plan=recommendXboxProfile(scope,usage,Object.keys(md.controls),src,md);
      assert.ok(plan.changes.length<=40);
      assert.ok(plan.changes.every(c=>c.slot!=="axis"&&!c.replaceExisting&&c.modifiers.length===0));
      assert.ok(plan.changes.every(c=>src.some(b=>b.device===c.device&&b.key===c.key&&b.slot!=="axis")));
      assert.ok(new Set(plan.changes.map(c=>c.device)).size<=1);
      assert.ok(new Set(plan.changes.map(c=>bindingKey(c))).size===plan.changes.length);
    }
});

test("unrecognized physical buttons are reported, not mislabeled",()=>{
  const src=[b("PrimaryFire","Pad_UnknownButton"),b("HumanoidJumpButton","Joy_2","primary","DualShock4")];
  assert.equal(xboxUnrecognized(src,md).length,1);
  const p=recommendXboxProfile("ship","combat",Object.keys(md.controls),src,md);
  assert.equal(p.changes.length,0);
  assert.ok(p.warnings.some(x=>/Aucune manette Xbox/.test(x)));
});

test("Xbox diagram is present for Xbox tab and retains the original confirmation flow",()=>{
  const view=read("src/views/controls/xboxControllerDiagram.ts");
  const editor=read("src/views/controls/presetEditor.ts");
  const css=read("public/xbox-controller-v1614.css");
  const page=read("public/index.html");
  for(const v of ["xboxOutline","xboxAssignments","xboxUnrecognized",
    "data-xbox-control","xboxControllerDiagram","role:\"region\"","Lecture seule"])
    assert.ok(view.includes(v),v);
  for(const v of ["xboxControllerDiagram({","xboxDiagram,",
    "recommendXboxProfile","stageAdvice","controlsSavePresetBatch","window.confirm("])
    assert.ok(editor.includes(v),v);
  assert.ok(css.includes(".edch-xbox-control.selected"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(page.includes("xbox-controller-v1614.css"));
  assert.doesNotMatch(view,/controlsSavePresetBatch|writeFile|\.binds.+write/);
});
