import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  FOOT_MOUSE_CONTROLS,isMouseDevice,isMouseInput,mouseControlMatches,
  mouseAssignments,digitalMouseInputs,recommendFootMouse,
} from "../dist/js/features/controls/virtualFootMouse.js";
import {isStagedAssignmentValid} from "../dist/js/features/controls/presetAdvisor.js";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const meta={controls:{
  HumanoidPrimaryFireButton:{g:"OnFoot",n:"Tir"},
  HumanoidZoomButton:{g:"OnFoot",n:"Zoom"},
  HumanoidSecondaryInteractButton:{g:"OnFoot",n:"Interaction 2"},
  HumanoidForwardButton:{g:"OnFoot",n:"Avancer"},
  PrimaryFire:{g:"Ship",n:"Tir vaisseau"},
  BuggyPrimaryFireButton:{g:"SRV",n:"Tir SRV"},
},devices:{},templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{}};
const b=(action,key,slot="primary",device="Mouse",modifiers=[])=>
 ({action,key,slot,device,modifiers});
const draft=(action,key,replaceExisting=false)=>
 ({action,key,device:"Mouse",slot:"secondary",modifiers:[],replaceExisting});
const actions=Object.keys(meta.controls);

test("graphic represents mouse L/R/M, two side buttons, scroll up/down and X/Y axes",()=>{
  const ids=FOOT_MOUSE_CONTROLS.map(x=>x.id);
  assert.equal(new Set(ids).size,9);
  for(const id of ["Mouse_1","Mouse_2","Mouse_3","Mouse_4","Mouse_5",
    "Pos_Mouse_ZAxis","Neg_Mouse_ZAxis","Mouse_XAxis","Mouse_YAxis"])
    assert.ok(ids.includes(id),id);
  assert.equal(isMouseDevice("Mouse"),true);
  assert.equal(isMouseDevice("GamePad"),false);
});

test("signed mouse wheel and axis inputs are shown without conflation",()=>{
  assert.equal(mouseControlMatches("Pos_Mouse_ZAxis","Mouse","Pos_Mouse_ZAxis"),true);
  assert.equal(mouseControlMatches("Neg_Mouse_ZAxis","Mouse","Pos_Mouse_ZAxis"),false);
  assert.equal(mouseControlMatches("Neg_Mouse_ZAxis","Mouse","Neg_Mouse_ZAxis"),true);
  assert.equal(mouseControlMatches("Mouse_XAxis","Mouse","Neg_Mouse_XAxis"),true);
  assert.equal(mouseControlMatches("Mouse_XAxis","Mouse","Mouse_YAxis"),false);
  assert.equal(mouseControlMatches("Mouse_1","Keyboard","Mouse_1"),false);
});

test("on-foot assignments are separated from ship/SRV and source is unchanged",()=>{
  const origin=[b("HumanoidPrimaryFireButton","Mouse_1"),
    b("PrimaryFire","Mouse_1"),b("BuggyPrimaryFireButton","Mouse_1")];
  const copy=JSON.stringify(origin);
  const summary=mouseAssignments("Mouse_1",origin,[],meta);
  assert.deepEqual(summary.existing.map(x=>x.action),["HumanoidPrimaryFireButton"]);
  assert.equal(summary.draft.length,0);
  assert.equal(JSON.stringify(origin),copy);
});

test("a pending replacement hides old key only in visual preview",()=>{
  const origin=[b("HumanoidPrimaryFireButton","Mouse_2","secondary")];
  const staged=[draft("HumanoidPrimaryFireButton","Mouse_1",true)];
  assert.equal(mouseAssignments("Mouse_2",origin,staged,meta).existing.length,0);
  assert.equal(mouseAssignments("Mouse_1",origin,staged,meta).draft.length,1);
  assert.equal(origin[0].key,"Mouse_2");
});

test("wheel, axes and modifiers are visible but cannot be staged as digital mouse inputs",()=>{
  const origin=[
    b("HumanoidPrimaryFireButton","Mouse_1"),
    b("HumanoidZoomButton","Pos_Mouse_ZAxis","secondary"),
    b("HumanoidForwardButton","Neg_Mouse_XAxis","axis"),
    b("HumanoidSecondaryInteractButton","Mouse_4","primary","Mouse",
      [{device:"Keyboard",key:"Key_LeftShift"}]),
    b("PrimaryFire","Mouse_1"),
  ];
  const digital=digitalMouseInputs(origin);
  assert.deepEqual(digital.map(x=>x.key),["Mouse_1"]);
  assert.equal(mouseAssignments("Pos_Mouse_ZAxis",origin,[],meta).existing.length,1);
  assert.equal(mouseAssignments("Mouse_XAxis",origin,[],meta).existing[0].slot,"axis");
  assert.equal(isMouseInput("Mouse_ZAxis"),true);
  assert.equal(isMouseInput("Invalid_Button"),false);
});

test("safe foot suggestions reuse Mouse_1/2/3 only if actually in the source",()=>{
  const source=[b("PrimaryFire","Mouse_1"),b("PrimaryFire","Mouse_2","secondary"),
    b("BuggyPrimaryFireButton","Mouse_3")];
  const before=JSON.stringify(source);
  const plan=recommendFootMouse(actions,source,meta);
  assert.equal(plan.changes.length,3);
  assert.deepEqual(plan.changes.map(c=>c.key),["Mouse_1","Mouse_2","Mouse_3"]);
  assert.ok(plan.changes.every(c=>isStagedAssignmentValid(c,actions,source)));
  assert.ok(plan.changes.every(c=>c.slot!=="axis"&&!c.replaceExisting));
  assert.equal(JSON.stringify(source),before);
});

test("unknown mouse buttons are never fabricated or automatically assigned",()=>{
  const source=[b("PrimaryFire","Mouse_1")];
  const plan=recommendFootMouse(actions,source,meta);
  assert.deepEqual(plan.changes.map(x=>x.key),["Mouse_1"]);
  assert.ok(plan.skipped.some(x=>x.includes("Mouse_2")));
});

test("busy foot button and two occupied assignment slots are safely skipped",()=>{
  const source=[
    b("HumanoidForwardButton","Mouse_1"),
    b("PrimaryFire","Mouse_1","secondary"),
    b("PrimaryFire","Mouse_2"),
    b("HumanoidZoomButton","Key_F","primary","Keyboard"),
    b("HumanoidZoomButton","Key_T","secondary","Keyboard"),
  ];
  const plan=recommendFootMouse(actions,source,meta);
  assert.ok(!plan.changes.some(c=>c.action==="HumanoidPrimaryFireButton"));
  assert.ok(!plan.changes.some(c=>c.action==="HumanoidZoomButton"));
  assert.ok(plan.skipped.some(x=>x.includes("emplacements occupés")));
});

test("mouse modifiers show dependent action in the on-foot view",()=>{
  const original=[b("HumanoidPrimaryFireButton","Key_G","secondary","Keyboard",
    [{device:"Mouse",key:"Mouse_4"}])];
  const state=mouseAssignments("Mouse_4",original,[],meta);
  assert.equal(state.existing.length,1);
  assert.equal(state.existing[0].isModifier,true);
});

test("AZERTY + mouse shares foot tab without changing other device tabs or file writer",()=>{
  const view=read("src/views/controls/virtualFootMouse.ts");
  const editor=read("src/views/controls/presetEditor.ts");
  const css=read("public/foot-mouse-v1616.css");
  const html=read("public/index.html");
  assert.ok(view.includes("Souris · commandes à pied"));
  assert.ok(view.includes("mouseAssignments("));
  assert.ok(view.includes("data-mouse-control"));
  assert.ok(editor.includes('this.family==="azerty"&&this.mode==="foot" ? virtualFootMouse('));
  assert.ok(editor.includes("digitalMouseInputs(src.binds)"));
  assert.ok(editor.includes("recommendFootMouse(src.actions,src.binds,meta)"));
  assert.ok(editor.includes('this.repaint("mouse")'));
  assert.ok(editor.includes("Clavier AZERTY + souris"));
  assert.ok(editor.includes("controlsSavePresetBatch"));
  assert.ok(css.includes(".edch-mouse-btn.selected"));
  assert.ok(html.includes("foot-mouse-v1616.css"));
  assert.doesNotMatch(view,/controlsSavePresetBatch|writeFile|fetch\(/);
});
