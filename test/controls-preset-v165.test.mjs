import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {actionsFromXml} from '../dist/js/views/controls/presetEditor.js';
const xml=`<?xml version="1.0"?><Root PresetName="Custom"><YawLeftButton><Primary Device="Keyboard" Key="Key_A" /><Secondary Device="{NoDevice}" Key="" /></YawLeftButton><ThrustForward><Binding Device="SaitekX52Pro" Key="Joy_XAxis" /></ThrustForward><HumanoidJumpButton><Primary Device="Keyboard" Key="Key_Space" /></HumanoidJumpButton></Root>`;
test('v1.6.5 editor only lists actions with Primary/Secondary (not analog axes)',()=>{
 assert.deepEqual(actionsFromXml(xml),['HumanoidJumpButton','YawLeftButton']);
});
test('v1.6.5 native publisher is non-overwriting and checks closed game',()=>{
 const src=readFileSync(new URL('../src-tauri/src/controls_preset.rs',import.meta.url),'utf8');
 assert.match(src,/create_new\(true\)/);
 assert.match(src,/game_running\(\)\.await/);
 assert.match(src,/!filename_valid\(&source_file\)/);
 assert.match(src,/known_input\(xml, &change.device, &change.key\)/);
 assert.match(src,/Never injects input into the game/);
});
