import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
test('editor offers in-game categories, profile suggestion and explicit per-slot preview',()=>{
 const content=read('src/views/controls/presetEditor.ts');
 for(const term of ['Vaisseau','VRS','À pied','Interface / cartes','Principale','Secondaire','Préparer les suggestions','Brouillon à valider','controlsSavePresetBatch'])assert.ok(content.includes(term),term);
 assert.match(content,/window\.confirm\(/);
});
test('native batch path retains source read-only and no game input automation',()=>{
 const rust=read('src-tauri/src/controls_preset.rs');
 for(const term of ['controls_save_preset_batch','rewrite_xml_batch','create_new(true)','game_running().await','symlink_metadata','duplicate modification'])assert.ok(rust.includes(term),term);
 assert.equal(rust.includes('write_all(changed.as_bytes())'),true);
});
test('control styling has responsive layouts and focus outlines',()=>{
 const css=read('public/controls-pro.css');
 assert.ok(css.includes('@media(max-width:1100px)'));
 assert.ok(css.includes(':focus-visible'));
 assert.ok(css.includes('.edch-c166-current'));
});
