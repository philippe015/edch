import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  ENERGY_LINK_ACTION,ENERGY_LINK_DEFAULT_KEY,ENERGY_LINK_RELATED,planEnergyLink,
} from "../dist/js/features/controls/energyLink.js";
import {PREPARED_TEMPLATES,prepareAzerty,sectionForAction} from "../dist/js/features/controls/preparedProfiles.js";
import {PREPARED_AZERTY_KEYS} from "../dist/js/features/controls/preparedKeys.js";
import {isStagedAssignmentValid} from "../dist/js/features/controls/presetAdvisor.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const md={controls:{
  HumanoidSwitchToRechargeTool:{g:"OnFoot",c:"Combat",n:"Recharge Tool"},
  HumanoidToggleToolModeButton:{g:"OnFoot",c:"Combat",n:"Tool Mode"},
  HumanoidPrimaryFireButton:{g:"OnFoot",c:"Combat",n:"Fire"},
  HumanoidBattery:{g:"OnFoot",c:"Combat",n:"Battery Pack"},
  HumanoidSelectPrimaryWeaponButton:{g:"OnFoot",c:"Combat",n:"WEP 1"},
  HumanoidForwardButton:{g:"OnFoot",c:"Combat",n:"Move Forward"},
  PrimaryFire:{g:"Ship",c:"Combat",n:"Fire"},
},devices:{},templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{}};
const bind=(action,key,device="Keyboard",slot="primary",modifiers=[])=>
  ({action,key,device,slot,modifiers});
const actions=Object.keys(md.controls);

test("Energy Link action is the real Odyssey equip tool, separate from energy cells",()=>{
  const catalog=JSON.parse(read("public/data/binds.json"));
  assert.equal(ENERGY_LINK_ACTION,"HumanoidSwitchToRechargeTool");
  assert.equal(ENERGY_LINK_DEFAULT_KEY,"Key_3");
  assert.equal(catalog.controls[ENERGY_LINK_ACTION].g,"OnFoot");
  for(const item of ENERGY_LINK_RELATED)
    assert.ok(catalog.controls[item.action],item.action);
  assert.notEqual(ENERGY_LINK_ACTION,"HumanoidBattery");
  assert.equal(sectionForAction("foot",ENERGY_LINK_ACTION,catalog),"tools");
});

test("shortcut 3 is allowed by both frontend and strict native whitelist",()=>{
  assert.ok(PREPARED_AZERTY_KEYS.includes("Key_3"));
  const rust=read("src-tauri/src/controls_preset.rs");
  const inner=rust.split("const PREPARED_AZERTY_KEYS: &[&str] = &[")[1]?.split("];")[0]??"";
  const native=[...inner.matchAll(/"(Key_[A-Za-z0-9]+)"/g)].map(x=>x[1]);
  assert.deepEqual(native,PREPARED_AZERTY_KEYS);
  const plan=planEnergyLink(actions,[],md);
  assert.equal(plan.available,true);
  assert.equal(plan.suggestion?.key,"Key_3");
  assert.equal(plan.suggestion?.replaceExisting,false);
  assert.equal(isStagedAssignmentValid(plan.suggestion,actions,[]),true);
});

test("already assigned Key_3 is not duplicated",()=>{
  const p=planEnergyLink(actions,[bind(ENERGY_LINK_ACTION,"Key_3")],md);
  assert.equal(p.suggestion,null);
  assert.match(p.reason,/déjà affectée/);
});

test("a different current keyboard binding is preserved and reported",()=>{
  const current=[bind(ENERGY_LINK_ACTION,"Key_5")];
  const snapshot=JSON.stringify(current);
  const p=planEnergyLink(actions,current,md);
  assert.equal(p.suggestion,null);
  assert.equal(p.assigned[0].key,"Key_5");
  assert.equal(JSON.stringify(current),snapshot);
});

test("Key_3 used by another on-foot action blocks the proposal",()=>{
  const existing=[bind("HumanoidSelectPrimaryWeaponButton","Key_3")];
  const p=planEnergyLink(actions,existing,md);
  assert.equal(p.suggestion,null);
  assert.match(p.reason,/déjà utilisée/);
});

test("Key_3 may be reused across independent ship and foot contexts",()=>{
  const p=planEnergyLink(actions,[bind("PrimaryFire","Key_3")],md);
  assert.equal(p.suggestion?.key,"Key_3");
});

test("existing mouse primary binding is preserved; only empty secondary gets Key_3",()=>{
  const old=[bind(ENERGY_LINK_ACTION,"Mouse_4","Mouse")];
  const p=planEnergyLink(actions,old,md);
  assert.equal(p.suggestion?.slot,"secondary");
  assert.equal(p.suggestion?.replaceExisting,false);
  assert.equal(old[0].key,"Mouse_4");
});

test("both slots busy or absent action produce no synthetic mapping",()=>{
  const busy=[
    bind(ENERGY_LINK_ACTION,"Mouse_4","Mouse","primary"),
    bind(ENERGY_LINK_ACTION,"Joy_4","SaitekX52Pro","secondary"),
  ];
  assert.equal(planEnergyLink(actions,busy,md).suggestion,null);
  assert.equal(planEnergyLink(actions.filter(x=>x!==ENERGY_LINK_ACTION),[],md).available,false);
  assert.equal(planEnergyLink(actions.filter(x=>x!==ENERGY_LINK_ACTION),[],md).suggestion,null);
});

test("all four Odyssey prepared layouts include the tool only when safe",()=>{
  const foot=PREPARED_TEMPLATES.filter(t=>t.scope==="foot");
  assert.equal(foot.length,4);
  for(const tpl of foot){
    assert.ok(tpl.rules.some(r=>r.action===ENERGY_LINK_ACTION&&r.key==="Key_3"),tpl.label);
    const p=prepareAzerty("foot",tpl.usage,actions,[],md);
    assert.ok(p.changes.some(c=>c.action===ENERGY_LINK_ACTION&&c.key==="Key_3"),tpl.label);
    const conflict=prepareAzerty("foot",tpl.usage,actions,[
      bind("HumanoidSelectPrimaryWeaponButton","Key_3"),
    ],md);
    assert.ok(!conflict.changes.some(c=>c.action===ENERGY_LINK_ACTION),tpl.label);
  }
});

test("on-foot interface displays real bindings, helpful actions and optional shortcut",()=>{
  const editor=read("src/views/controls/presetEditor.ts");
  const html=read("public/index.html");
  const css=read("public/energylink-v1617.css");
  for(const phrase of ["Recharge de la combinaison · Energy Link",
    "energyLinkPlan","ENERGY_LINK_RELATED","Voir / configurer",
    "Préparer Energy Link sur la touche 3","this.stageAdvice",
    "controlsSaveNamedPresetBatch","this.query=item.action"])
    assert.ok(editor.includes(phrase),phrase);
  assert.ok(css.includes(".edch-energylink-action"));
  assert.ok(html.includes("energylink-v1617.css"));
});
