import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('physical capture is rendered inside the real bindings editor',()=>{
 const editor=read('src/views/controls/presetEditor.ts');
 assert.match(editor,/new HotasStudio\(\)/);
 assert.match(editor,/this\.hotasStudio\.render\(/);
 assert.match(editor,/this\.editInput = bindingKey\(input\)/);
 assert.match(editor,/Ajouter au brouillon/);
});
test('physical controls require explicit user action and cannot inject game input',()=>{
 const panel=read('src/views/controls/hotasStudio.ts');
 for(const label of ['Rechercher le HOTAS','Capturer un bouton','Observer un axe','Choisir cette touche','Linux et Proton']) assert.ok(panel.includes(label),label);
 assert.doesNotMatch(panel,/sendInput|uinput|ydotool|xdotool|keypress|game_focused/);
});
test('Rust joystick backend uses only validated Linux char-devices and no writes',()=>{
 const rust=read('src-tauri/src/hotas.rs');
 for(const token of ['valid_js_id','/sys/class/input','/dev/input','is_char_device','poll(&mut pfd','JS_INIT','spawn_blocking']) assert.ok(rust.includes(token),token);
 assert.doesNotMatch(rust,/OpenOptions.*write|create_new\(true\)|File::create|Command::new/);
});
test('new CSS is responsive and hardware layout is illustrative',()=>{
 const css=read('public/controls-pro.css');
 for(const k of ['.edch-hotas-visuals','.edch-hotas-stick','.edch-hotas-throttle','@media(max-width:710px)']) assert.ok(css.includes(k));
});
