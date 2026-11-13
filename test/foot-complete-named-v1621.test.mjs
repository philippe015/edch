import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  FOOT_ESSENTIAL_RULES,FOOT_NAMED_PRESET,FOOT_MANUAL_PRESET,
  suggestedPresetName,planCompleteFoot,missingFootMovement,
} from "../dist/js/features/controls/footCompleteProfiles.js";
import {isStagedAssignmentValid} from "../dist/js/features/controls/presetAdvisor.js";
import {approvedCapturedKeyboardKey} from "../dist/js/features/controls/footDirectCapture.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const meta=JSON.parse(read("public/data/binds.json"));
const actions=Object.keys(meta.controls);
const b=(action,key,device="Keyboard",slot="primary")=>({action,key,device,slot,modifiers:[]});

test("game-visible preset names are descriptive and remain under Odyssey limit",()=>{
  assert.deepEqual(FOOT_NAMED_PRESET,{
    balanced:"EDCH_PIED_AZERTY",navigation:"EDCH_PIED_NAVIGATION",
    combat:"EDCH_PIED_COMBAT",exploration:"EDCH_PIED_EXPLORATION",
  });
  assert.equal(FOOT_MANUAL_PRESET,"EDCH_PIED_PERSONNALISE");
  for(const usage of ["balanced","navigation","combat","exploration"]){
    const name=suggestedPresetName("foot","azerty",usage,true);
    assert.equal(name,FOOT_NAMED_PRESET[usage]);
    assert.match(name,/^EDCH_[A-Z_]{1,35}$/);
    assert.ok(name.length<=40);
  }
  assert.equal(suggestedPresetName("foot","azerty","balanced",false),FOOT_MANUAL_PRESET);
  assert.ok(suggestedPresetName("ship","hotas","combat",true).startsWith("EDCH_VAISSEAU"));
});

test("complete on-foot proposal has diverse real actions and distinct supported AZERTY keys",()=>{
  assert.ok(FOOT_ESSENTIAL_RULES.length>=35);
  assert.ok(FOOT_ESSENTIAL_RULES.length<=64);
  assert.equal(new Set(FOOT_ESSENTIAL_RULES.map(r=>r.action)).size,FOOT_ESSENTIAL_RULES.length);
  assert.equal(new Set(FOOT_ESSENTIAL_RULES.map(r=>r.key)).size,FOOT_ESSENTIAL_RULES.length);
  for(const x of FOOT_ESSENTIAL_RULES){
    assert.equal(meta.controls[x.action]?.g,"OnFoot",x.action);
    assert.equal(approvedCapturedKeyboardKey("Keyboard",x.key,[]),true,x.key);
  }
  for(const action of ["HumanoidForwardButton","HumanoidBackwardButton",
    "HumanoidStrafeLeftButton","HumanoidStrafeRightButton",
    "HumanoidSwitchToRechargeTool","HumanoidSwitchToCompAnalyser",
    "HumanoidBattery","HumanoidHealthPack","HumanoidReloadButton",
    "HumanoidHideWeaponButton","HumanoidSelectPrimaryWeaponButton",
    "HumanoidSelectEMPGrenade","HumanoidToggleToolModeButton"])
    assert.ok(FOOT_ESSENTIAL_RULES.some(r=>r.action===action),action);
});

test("screenshot regression: the game had W/S/Q/D; future foot preset must use Z/S/Q/D",()=>{
  const original=[
    b("HumanoidForwardButton","Key_W"),
    b("HumanoidBackwardButton","Key_S"),
    b("HumanoidStrafeLeftButton","Key_Q"),
    b("HumanoidStrafeRightButton","Key_D"),
    b("HumanoidPrimaryFireButton","Mouse_1","Mouse"),
  ];
  const snapshot=JSON.stringify(original);
  const plan=planCompleteFoot("balanced",actions,original,meta);
  const forward=plan.changes.find(x=>x.action==="HumanoidForwardButton");
  assert.equal(forward?.key,"Key_Z");
  assert.equal(forward?.slot,"primary");
  assert.equal(forward?.replaceExisting,true);
  assert.ok(!plan.changes.some(x=>x.action==="HumanoidStrafeLeftButton"));
  assert.deepEqual(missingFootMovement(original,plan.changes),[]);
  assert.ok(plan.changes.every(x=>isStagedAssignmentValid(x,actions,original)));
  assert.equal(JSON.stringify(original),snapshot);
  assert.equal(plan.namedPreset,"EDCH_PIED_AZERTY");
  assert.ok(plan.changes.every(c=>c.device==="Keyboard"));
});

test("a key already used by an unchanged on-foot command is skipped; not presented as complete",()=>{
  const original=[
    b("HumanoidForwardButton","Key_W"),
    b("HumanoidStrafeLeftButton","Key_Q"),
    b("HumanoidHealthPack","Key_Z"),
    b("HumanoidBackwardButton","Key_S"),
    b("HumanoidStrafeRightButton","Key_D"),
  ];
  const plan=planCompleteFoot("balanced",actions,original,meta);
  assert.ok(!plan.changes.some(x=>x.action==="HumanoidForwardButton"));
  assert.ok(plan.skipped.some(x=>x.action==="HumanoidForwardButton"&&/utilisée/.test(x.reason)));
  assert.ok(missingFootMovement(original,plan.changes).some(x=>x.action==="HumanoidForwardButton"));
});

test("nonkeyboard binds are preserved, only genuinely available slots get keyboard",()=>{
  const original=[
    b("HumanoidJumpButton","Joy_1","SaitekX52Pro"),
    b("HumanoidPrimaryFireButton","Mouse_1","Mouse"),
    b("HumanoidToggleFlashlightButton","Mouse_4","Mouse"),
  ];
  const plan=planCompleteFoot("combat",actions,original,meta);
  assert.equal(plan.changes.find(x=>x.action==="HumanoidJumpButton")?.slot,"secondary");
  assert.equal(plan.changes.find(x=>x.action==="HumanoidJumpButton")?.replaceExisting,false);
  assert.equal(plan.changes.find(x=>x.action==="HumanoidToggleFlashlightButton")?.slot,"secondary");
  assert.ok(plan.changes.every(x=>x.device==="Keyboard"&&x.slot!=="axis"));
  assert.ok(plan.changes.length<=64);
  assert.ok(plan.changes.every(x=>isStagedAssignmentValid(x,actions,original)));
});

test("unassigned on-foot commands are reported; analog movement axes are excluded",()=>{
  const plan=planCompleteFoot("exploration",actions,[],meta);
  assert.ok(plan.totalDigital>=FOOT_ESSENTIAL_RULES.length);
  assert.ok(plan.unassigned.includes("HumanoidEmoteSlot1"));
  assert.ok(!plan.unassigned.includes("HumanoidForwardAxis"));
  assert.ok(plan.skipped.every(x=>x.reason.length>0));
  assert.ok(plan.warnings.some(x=>x.includes("axes")));
  assert.deepEqual(missingFootMovement([],[]).map(x=>x.key),["Key_Z","Key_S","Key_Q","Key_D"]);
});

test("frontend passes names to native writer and blocks incomplete AZERTY ZQSD",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  const bridge=read("src/platform/bridge.ts");
  for(const str of ["planCompleteFoot(style.id","missingFootMovement(src.binds,this.staged)",
    "Nom du préréglage visible dans Odyssey","Toutes les propositions À pied",
    "controlsSavePresetBatch(source.filename,this.staged,name)",
    "ZQSD incomplet","this.staged.length<=64","requestedPresetName"])
    assert.ok(editor.includes(str),str);
  assert.ok(bridge.includes("requestedPresetName: requestedPresetName??null"));
});

test("native writer creates unique named .binds, checks generated slots, never overwrites",()=>{
  const rust=read("src-tauri/src/controls_preset.rs");
  for(const str of ["requested_preset_name: Option<String>","fn named_preset_candidate(",
    "fn preset_name_present(","fn verify_profile_changes(","create_new(true)",
    "rename_profile_root(&xml,&preflight_name)","changes.len() > 64"])
    assert.ok(rust.includes(str),str);
  assert.ok(rust.includes('attr(&changed[root_at..root_end],"PresetName").as_deref()!=Some(preset.as_str())'));
  assert.ok(rust.includes("game_running().await"));
  assert.ok(!rust.includes("fs::remove_file(&source_file)"));
});
