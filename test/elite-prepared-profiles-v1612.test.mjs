import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GAME_SECTIONS, PREPARED_TEMPLATES, prepareAzerty, sectionForAction,
} from "../dist/js/features/controls/preparedProfiles.js";
import { PREPARED_AZERTY_KEYS, approvedPreparedKey } from "../dist/js/features/controls/preparedKeys.js";
import { isStagedAssignmentValid } from "../dist/js/features/controls/presetAdvisor.js";
const read = file => readFileSync(new URL("../"+file,import.meta.url),"utf8");
const b=(action,key,device="Keyboard",slot="primary")=>({action,device,key,slot,modifiers:[]});
const md={controls:{
  ForwardThrustButton:{g:"Ship",c:"Navigation"},
  BackwardThrustButton:{g:"Ship",c:"Navigation"},
  LeftThrustButton:{g:"Ship",c:"Navigation"},
  RightThrustButton:{g:"Ship",c:"Navigation"},
  HyperSuperCombination:{g:"Ship",c:"Navigation"},
  LandingGearToggle:{g:"Ship",c:"Navigation"},
  PrimaryFire:{g:"Ship",c:"Combat"},
  SteerLeftButton:{g:"SRV",c:"Navigation"},
  SteerRightButton:{g:"SRV",c:"Navigation"},
  IncreaseSpeedButtonPartial:{g:"SRV",c:"Navigation"},
  AutoBreakBuggyButton:{g:"SRV",c:"Navigation"},
  ToggleBuggyTurretButton:{g:"SRV",c:"Combat"},
  HumanoidForwardButton:{g:"OnFoot",c:"Combat"},
  HumanoidBackwardButton:{g:"OnFoot",c:"Combat"},
  HumanoidStrafeLeftButton:{g:"OnFoot",c:"Combat"},
  HumanoidStrafeRightButton:{g:"OnFoot",c:"Combat"},
  HumanoidJumpButton:{g:"OnFoot",c:"Combat"},
  HumanoidSprintButton:{g:"OnFoot",c:"Combat"},
  HumanoidCrouchButton:{g:"OnFoot",c:"Combat"},
  HumanoidReloadButton:{g:"OnFoot",c:"Combat"},
  HumanoidPrimaryInteractButton:{g:"OnFoot",c:"Combat"},
  HumanoidToggleFlashlightButton:{g:"OnFoot",c:"Combat"},
},devices:{},templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{}};
const actions=Object.keys(md.controls);

test("12 prepared choices: ship, SRV and Odyssey in four styles",()=>{
  assert.equal(PREPARED_TEMPLATES.length,12);
  assert.deepEqual([...new Set(PREPARED_TEMPLATES.map(x=>x.scope))],["ship","srv","foot"]);
  for(const scope of ["ship","srv","foot"]){
    assert.deepEqual(PREPARED_TEMPLATES.filter(t=>t.scope===scope).map(t=>t.usage),
      ["balanced","navigation","combat","exploration"]);
    assert.ok(GAME_SECTIONS[scope].length>=4);
    for(const t of PREPARED_TEMPLATES.filter(t=>t.scope===scope)){
      assert.equal(new Set(t.rules.map(r=>r.key)).size,t.rules.length,t.label+" has duplicate keys");
      assert.ok(t.rules.every(r=>approvedPreparedKey("Keyboard",r.key,[])),t.label+" has unknown keys");
    }
  }
});

test("AZERTY prepared ship profile uses ZQSD and never changes the source",()=>{
  const before=[b("PrimaryFire","Joy_1","SaitekX52Pro")];
  const original=JSON.stringify(before);
  const out=prepareAzerty("ship","balanced",actions,before,md);
  const keys=Object.fromEntries(out.changes.map(x=>[x.action,x.key]));
  assert.deepEqual([keys.ForwardThrustButton,keys.BackwardThrustButton,keys.LeftThrustButton,keys.RightThrustButton],
    ["Key_Z","Key_S","Key_Q","Key_D"]);
  assert.ok(out.changes.every(c=>c.device==="Keyboard"&&c.modifiers.length===0&&!c.replaceExisting));
  assert.ok(out.changes.every(c=>isStagedAssignmentValid(c,actions,before)));
  assert.equal(JSON.stringify(before),original);
});

test("SRV preset retains HOTAS and uses keyboard secondary if source primary is occupied",()=>{
  const before=[b("SteerLeftButton","Joy_6","SaitekX52Pro")];
  const out=prepareAzerty("srv","balanced",actions,before,md);
  const steer=out.changes.find(x=>x.action==="SteerLeftButton");
  assert.equal(steer.slot,"secondary");
  assert.equal(steer.key,"Key_Q");
  assert.equal(steer.replaceExisting,false);
});

test("existing correct key is not overwritten; occupied keyboard can be replaced only in new draft",()=>{
  const old=[b("HumanoidForwardButton","Key_Z"),b("HumanoidBackwardButton","Key_W")];
  const out=prepareAzerty("foot","balanced",actions,old,md);
  assert.equal(out.covered,1);
  assert.ok(!out.changes.some(x=>x.action==="HumanoidForwardButton"));
  const changed=out.changes.find(x=>x.action==="HumanoidBackwardButton");
  assert.equal(changed.key,"Key_S");
  assert.equal(changed.slot,"primary"); // replace only the keyboard input in the NEW profile
  assert.equal(changed.replaceExisting,true);
});

test("occupied keys in same context are not offered; keys across contexts may be reused",()=>{
  const current=[b("PrimaryFire","Key_Z")];
  const ship=prepareAzerty("ship","balanced",actions,current,md);
  assert.ok(!ship.changes.some(x=>x.key==="Key_Z"));
  assert.ok(ship.skipped.some(x=>x.key==="Key_Z"&&x.reason.includes("occupée")===false));
  const foot=prepareAzerty("foot","balanced",actions,current,md);
  assert.ok(foot.changes.some(x=>x.key==="Key_Z"));
});

test("unknown action and made-up controller buttons always fail validation",()=>{
  const before=[];
  assert.equal(isStagedAssignmentValid({
    action:"Unknown",slot:"primary",device:"Keyboard",key:"Key_Z",modifiers:[],replaceExisting:false,
  },actions,before),false);
  assert.equal(isStagedAssignmentValid({
    action:"ForwardThrustButton",slot:"primary",device:"SaitekX52Pro",key:"Joy_999",modifiers:[],replaceExisting:false,
  },actions,before),false);
  assert.equal(isStagedAssignmentValid({
    action:"ForwardThrustButton",slot:"primary",device:"GamePad",key:"Pad_MadeUp",modifiers:[],replaceExisting:false,
  },actions,before),false);
  assert.equal(approvedPreparedKey("Keyboard","Key_NotReal",[]),false);
  assert.equal(approvedPreparedKey("Keyboard","Key_Z",[{}]),false);
});

test("game-style categories distinguish actual action groups",()=>{
  assert.equal(sectionForAction("ship","ForwardThrustButton",md),"flight");
  assert.equal(sectionForAction("ship","HyperSuperCombination",md),"navigation");
  assert.equal(sectionForAction("ship","PrimaryFire",md),"combat");
  assert.equal(sectionForAction("srv","SteerLeftButton",md),"drive");
  assert.equal(sectionForAction("srv","ToggleBuggyTurretButton",md),"combat");
  assert.equal(sectionForAction("foot","HumanoidForwardButton",md),"movement");
  assert.equal(sectionForAction("foot","HumanoidReloadButton",md),"combat");
  assert.equal(sectionForAction("foot","HumanoidToggleFlashlightButton",md),"tools");
});

test("native and web prepared keyboard allowlists match exactly",()=>{
  const rust=read("src-tauri/src/controls_preset.rs");
  const section=rust.split("const PREPARED_AZERTY_KEYS: &[&str] = &[")[1]?.split("];")[0]??"";
  const keys=[...section.matchAll(/"(Key_[A-Za-z0-9]+)"/g)].map(m=>m[1]);
  assert.deepEqual(keys,PREPARED_AZERTY_KEYS);
  assert.ok(rust.includes("known_input(xml, &change.device, &change.key)"));
  assert.ok(rust.includes("prepared_keyboard_key(&change.device, &change.key, &change.modifiers)"));
  assert.ok(rust.includes("game_running().await"));
  assert.ok(rust.includes("create_new(true)"));
});

test("Elite-style UI shows categories and ready-made profiles but retains original confirmations",()=>{
  const view=read("src/views/controls/presetEditor.ts");
  const html=read("public/index.html");
  for(const needle of ["quickCards","Préparer · ","sectionTabs","GAME_SECTIONS","prepareAzerty","stageAdvice","Brouillon à valider","window.confirm(","controlsSavePresetBatch"])
    assert.ok(view.includes(needle),needle);
  assert.ok(html.includes("elite-prepared-profiles.css"));
});
