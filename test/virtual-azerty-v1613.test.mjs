import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assignmentsForVirtualKey, keyIds, virtualKeyCount,
} from "../dist/js/features/controls/virtualAzerty.js";
import { KEY_CAPS, KEY_IDS } from "../dist/js/views/controls/keyLayouts.js";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const meta={controls:{
  PrimaryFire:{g:"Ship",c:"Combat",n:"Tir"},
  ForwardThrustButton:{g:"Ship",c:"Navigation",n:"Avancer"},
  LandingGearToggle:{g:"Ship",c:"Navigation",n:"Train"},
  BuggyPrimaryFireButton:{g:"SRV",c:"Combat",n:"Tir SRV"},
  HumanoidForwardButton:{g:"OnFoot",c:"Combat",n:"Marche"},
  HumanoidJumpButton:{g:"OnFoot",c:"Combat",n:"Saut"},
},devices:{},templates:{},templateBase:"",keymap:{},vidpid:{},vendors:{}};
const bind=(action,key,slot="primary",modifiers=[],device="Keyboard")=>({action,key,slot,device,modifiers});
const staged=(action,key,replaceExisting=false)=>({action,key,slot:"primary",device:"Keyboard",modifiers:[],replaceExisting});

test("French ISO keymap shows actual AZERTY layout and standard control keys",()=>{
  assert.equal(KEY_IDS.azerty.r1.slice(0,6).join(","),"Key_A,Key_Z,Key_E,Key_R,Key_T,Key_Y");
  assert.equal(KEY_IDS.azerty.r2.slice(0,4).join(","),"Key_Q,Key_S,Key_D,Key_F");
  assert.equal(KEY_IDS.azerty.r3.slice(0,3).join(","),"Key_W,Key_X,Key_C");
  assert.equal(KEY_CAPS.azerty.r1.slice(0,6).join(""),"AZERTY");
  assert.ok(keyIds(KEY_IDS.azerty.iso).some(x=>x.includes("LessThan")));
  assert.deepEqual(keyIds("Key_Escape"),["Key_Escape"]);
  assert.equal(KEY_CAPS.azerty.num[1],"& 1");
});

test("key display filters to active game context only and never modifies the source",()=>{
  const orig=[bind("ForwardThrustButton","Key_Z"),bind("BuggyPrimaryFireButton","Key_Z"),
    bind("HumanoidForwardButton","Key_Z")];
  const save=JSON.stringify(orig);
  const ship=assignmentsForVirtualKey("Key_Z","ship",orig,[],meta);
  assert.deepEqual(ship.existing.map(x=>x.action),["ForwardThrustButton"]);
  assert.equal(virtualKeyCount(ship),1);
  assert.deepEqual(assignmentsForVirtualKey("Key_Z","srv",orig,[],meta).existing.map(x=>x.action),["BuggyPrimaryFireButton"]);
  assert.deepEqual(assignmentsForVirtualKey("Key_Z","foot",orig,[],meta).existing.map(x=>x.action),["HumanoidForwardButton"]);
  assert.equal(JSON.stringify(orig),save);
});

test("clicking a proposed AZERTY key can show its draft and its old binding separately",()=>{
  const orig=[bind("ForwardThrustButton","Key_W")];
  const draft=[staged("ForwardThrustButton","Key_Z",true)];
  const z=assignmentsForVirtualKey("Key_Z","ship",orig,draft,meta);
  assert.equal(z.existing.length,0);
  assert.equal(z.prepared.length,1);
  assert.equal(z.prepared[0].kind,"prepared");
  const w=assignmentsForVirtualKey("Key_W","ship",orig,draft,meta);
  assert.equal(w.existing.length,0,"replaced source slot should not remain highlighted");
  assert.equal(w.prepared.length,0);
  assert.equal(JSON.stringify(orig),JSON.stringify([bind("ForwardThrustButton","Key_W")]));
});

test("keyboard modifer keys display dependent actions but only for their active scope",()=>{
  const binds=[
    bind("PrimaryFire","Joy_1","primary",[{device:"Keyboard",key:"Key_LeftShift"}],"SaitekX52Pro"),
    bind("HumanoidJumpButton","Key_Space"),
  ];
  const shift=assignmentsForVirtualKey("Key_LeftShift","ship",binds,[],meta);
  assert.equal(shift.existing.length,1);
  assert.equal(shift.existing[0].usesModifier,true);
  assert.equal(shift.existing[0].device,"SaitekX52Pro");
  assert.equal(assignmentsForVirtualKey("Key_LeftShift","foot",binds,[],meta).existing.length,0);
});

test("aliases and keys without assignments are handled without invented information",()=>{
  const orig=[bind("LandingGearToggle","Key_Superscript_Two")];
  const found=assignmentsForVirtualKey(["Key_Grave","Key_Superscript_Two"],"ship",orig,[],meta);
  assert.equal(found.existing.length,1);
  assert.equal(virtualKeyCount(found),1);
  const blank=assignmentsForVirtualKey("Key_Numpad_8","ship",orig,[],meta);
  assert.equal(virtualKeyCount(blank),0);
});

test("virtual keyboard editor is visible only for AZERTY; no game or file writes",()=>{
  const view=read("src/views/controls/virtualAzertyKeyboard.ts");
  const editor=read("src/views/controls/presetEditor.ts");
  const css=read("public/virtual-azerty-v1613.css");
  const index=read("public/index.html");
  for(const val of ["KEY_IDS.azerty","KEY_CAPS.azerty","Clavier virtuel AZERTY",
    "Pavé numérique","Navigation","assignmentsForVirtualKey","onSelect",
    "aria-pressed","Lecture seule"])assert.ok(view.includes(val),val);
  assert.ok(editor.includes('this.family==="azerty" ? virtualAzertyKeyboard('));
  assert.ok(editor.includes("azertyKeyboard,"));
  assert.ok(editor.includes('this.repaint("keyboard")'));
  assert.ok(css.includes(".edch-vkb-key.selected"));
  assert.ok(css.includes("@media(max-width:900px)"));
  assert.ok(index.includes('virtual-azerty-v1613.css'));
  assert.doesNotMatch(view,/controlsSavePresetBatch|writeBgs|fetch\(|\.binds.*write/);
});
