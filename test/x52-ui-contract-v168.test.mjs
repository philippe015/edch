import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('X52 modes UI is linked to Commandes editor and has isolated styles',()=>{
 const editor=read('src/views/controls/presetEditor.ts');
 const ui=read('src/views/controls/x52ModesPanel.ts');
 const styles=read('public/controls-modes.css');
 assert.ok(editor.includes('new X52ModesPanel()'));
 assert.ok(editor.includes('modeProfiles'));
 assert.ok(ui.includes('Enregistrer les 3 fiches en HTML'));
 assert.ok(ui.includes('Tester la molette'));
 assert.ok(styles.includes('edch-x52-mode-grid'));
});
test('mode switch calibration remains optical/diagnostic and never writes to game',()=>{
 const ui=read('src/views/controls/x52ModesPanel.ts');
 assert.ok(ui.includes('hotasCapture(device,"button",10_000)'));
 assert.ok(ui.includes('pas automatiquement'));
 assert.ok(!ui.includes('controlsSavePresetBatch('));
 assert.ok(!ui.includes('uinput'));
 assert.ok(!ui.includes('StartPreset.'));
});
