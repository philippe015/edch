import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {namedPreset,matchedPresetFiles,safeEdchPresetName} from "../dist/js/features/controls/namedPresets.js";
import {FULL_FOOT_AZERTY_RULES,prepareCompleteFootAzerty} from "../dist/js/features/controls/completeFootPresets.js";
import {approvedCapturedKeyboardKey} from "../dist/js/features/controls/footDirectCapture.js";
import {isStagedAssignmentValid} from "../dist/js/features/controls/presetAdvisor.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const meta=JSON.parse(read("public/data/binds.json"));
const actions=Object.keys(meta.controls);
const b=(action,key,device="Keyboard",slot="primary",modifiers=[])=>({action,key,device,slot,modifiers});

test("named presets use stable, readable on-foot/ship/SRV names, not numbered EDCHPro",()=>{
  for(const style of ["balanced","navigation","combat","exploration"]){
    const value=namedPreset("foot","azerty",style);
    assert.match(value,/^EDCH_PIED_AZERTY_(?:POLY|NAV|COMBAT|EXPLORATION)$/);
    assert.equal(safeEdchPresetName(value),true);
    assert.ok(value.length<=40);
    assert.equal(value,namedPreset("foot","azerty",style));
  }
  assert.equal(namedPreset("ship","hotas","combat"),"EDCH_VAISSEAU_X52_COMBAT");
  assert.equal(namedPreset("srv","xbox","navigation"),"EDCH_SRV_XBOX_NAV");
  for(const value of ["EDCHPro0001","EDCH_", "EDCH_été","CUSTOM","EDCH_PIED COMBAT",
    "EDCH_PIED/OTHER","EDCH_X".repeat(8)])
    assert.equal(safeEdchPresetName(value),false);
});

test("old numeric names do not count as stable named profiles and never auto-archive",()=>{
  const files=["EDCHPro001.4.2.binds","EDCHPRO0003.4.2.binds","EDCH_PIED_AZERTY_POLY.4.2.binds",
    "EDCH_PIED_AZERTY_POLY.4.1.binds","Custom.4.2.binds"];
  assert.deepEqual(matchedPresetFiles("EDCH_PIED_AZERTY_POLY",files),
    ["EDCH_PIED_AZERTY_POLY.4.2.binds","EDCH_PIED_AZERTY_POLY.4.1.binds"]);
  assert.deepEqual(matchedPresetFiles("EDCH_PIED_AZERTY_COMBAT",files),[]);
});

test("every extended AZERTY rule has a real on-foot action, a distinct allowed key",()=>{
  const ids=new Set(),keys=new Set();
  assert.ok(FULL_FOOT_AZERTY_RULES.length>=65, "need more than short 11-key profiles");
  for(const r of FULL_FOOT_AZERTY_RULES){
    assert.equal(meta.controls[r.action]?.g,"OnFoot",r.action);
    assert.equal(approvedCapturedKeyboardKey("Keyboard",r.key,[]),true,r.key);
    assert.ok(!ids.has(r.action),"duplicate "+r.action);
    assert.ok(!keys.has(r.key),"reused key "+r.key);
    ids.add(r.action);keys.add(r.key);
  }
  for(const action of ["HumanoidForwardButton","HumanoidStrafeLeftButton",
    "HumanoidSwitchToRechargeTool","HumanoidBattery","HumanoidHealthPack",
    "HumanoidSelectEMPGrenade","HumanoidThrowGrenadeButton","HumanoidItemWheelButton"])
    assert.ok(ids.has(action),action);
});

test("WASD screenshot becomes ZQSD in an explicit complete on-foot draft",()=>{
  const source=[
    b("HumanoidForwardButton","Key_W"),
    b("HumanoidBackwardButton","Key_S"),
    b("HumanoidStrafeLeftButton","Key_A"),
    b("HumanoidStrafeRightButton","Key_D"),
    b("HumanoidPrimaryFireButton","Mouse_1","Mouse"),
    b("HumanoidZoomButton","Mouse_2","Mouse"),
    b("HumanoidSecondaryInteractButton","Mouse_3","Mouse","secondary"),
  ];
  const original=JSON.stringify(source);
  for(const usage of ["balanced","navigation","combat","exploration"]){
    const plan=prepareCompleteFootAzerty(usage,actions,source,meta);
    assert.ok(plan.changes.length>45,usage+" should propose most keys when .binds is sparse");
    assert.ok(plan.changes.some(c=>c.action==="HumanoidForwardButton"&&
      c.key==="Key_Z"&&c.replaceExisting),usage);
    assert.ok(plan.changes.some(c=>c.action==="HumanoidStrafeLeftButton"&&c.key==="Key_Q"),usage);
    assert.ok(!plan.changes.some(c=>c.action==="HumanoidPrimaryFireButton"));
    assert.ok(!plan.changes.some(c=>c.action==="HumanoidZoomButton"));
    assert.equal(plan.allActions,79);
    assert.ok(plan.preservedAxes===0);
    assert.ok(plan.changes.every(c=>isStagedAssignmentValid(c,actions,source)),usage);
    assert.ok(plan.changes.every(c=>c.slot!=="axis"&&
      (c.device==="Keyboard"||c.device==="Mouse")));
    assert.ok(new Set(plan.changes.map(c=>c.action+"|"+c.slot)).size===plan.changes.length);
  }
  assert.equal(JSON.stringify(source),original);
});

test("on-foot axes and HOTAS remain untouched; conflicts are visible rather than fabricated",()=>{
  const source=[
    b("HumanoidForwardAxis","Joy_YAxis","SaitekX52Pro","axis"),
    b("HumanoidForwardButton","Key_W"),
    b("HumanoidPrimaryInteractButton","Key_Z"),
    b("HumanoidPrimaryFireButton","Mouse_1","Mouse"),
    b("HumanoidReloadButton","Key_E"),
  ];
  const plan=prepareCompleteFootAzerty("balanced",actions,source,meta);
  assert.equal(plan.preservedAxes,1);
  assert.ok(plan.changes.every(c=>c.slot!=="axis"&&c.device!=="SaitekX52Pro"));
  assert.ok(plan.skipped.some(x=>x.action==="HumanoidForwardButton"&&/Touche/.test(x.reason)),
    "must not silently hijack Z when its owner is not rewritten");
  assert.ok(plan.warnings.some(x=>/axes/.test(x)));
});

test("all non-axis actions omitted from a sparse source are clearly reported",()=>{
  const src=[b("HumanoidForwardButton","Key_Z")];
  const p=prepareCompleteFootAzerty("exploration",
    ["HumanoidForwardButton","HumanoidBackwardButton","HumanoidPrimaryFireButton"],src,meta);
  assert.ok(p.unassigned.includes("HumanoidBackwardButton")===false,
    "backward should be covered by the planned key");
  assert.ok(p.unassigned.includes("HumanoidPrimaryFireButton"));
  assert.equal(p.covered>=1,true);
});

test("frontend uses named preset writer and shows errors, missing actions and explicit update",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  const rust=read("src-tauri/src/controls_preset.rs");
  const lib=read("src-tauri/src/lib.rs");
  const bridge=read("src/platform/bridge.ts");
  const html=read("public/index.html");
  for(const s of ["controlsSaveNamedPresetBatch","prepareCompleteFootAzerty",
    "namedPreset(this.mode,this.family,this.profile)","matchedPresetFiles",
    "Mettre à jour ce préréglage","Sauvegarder automatiquement",
    "Afficher les commandes encore sans touche","Nom du préréglage dans le jeu"])
    assert.ok(editor.includes(s),s);
  assert.ok(lib.includes("controls_save_named_preset_batch"));
  assert.ok(bridge.includes('invoke<ControlsPresetResult>("controls_save_named_preset_batch"'));
  assert.ok(rust.includes("fn verify_named_output("));
  assert.ok(rust.includes("owned_named_file(&destination,&preset_name)"));
  assert.ok(rust.includes("unique_update_paths"));
  assert.ok(rust.includes("EDCH_Backups"));
  assert.ok(rust.includes("set_french_keyboard_layout"));
  assert.ok(rust.includes('create_new(true)'));
  assert.ok(html.includes("named-odyssey-v1621.css"));
});

test("legacy numeric .binds are not deleted or overwritten in the new writer",()=>{
  const rust=read("src-tauri/src/controls_preset.rs");
  const named=rust.slice(rust.indexOf("pub async fn controls_save_named_preset_batch"));
  assert.ok(named.includes("safe_named_preset(&preset_name)"));
  assert.ok(named.includes("game_running().await"));
  assert.doesNotMatch(named,/EDCHPro\{n:03\}/);
  assert.ok(named.includes("if !update_existing"));
  assert.ok(named.includes("fs::rename(&destination,&backup)"));
  assert.ok(named.includes("fs::rename(&backup,&destination)"));
});
