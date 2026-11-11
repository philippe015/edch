import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const view=readFileSync(new URL('../src/views/controls/index.ts', import.meta.url),'utf8');
test('v1.6.4: ControlsView mounts PRO panel and preserves upstream editor, backups and device diagram',()=>{
  assert.match(view,/import \{ ControlsProPanel \} from "\.\/proPanel\.js"/);
  assert.match(view,/private commandesPro = new ControlsProPanel\(\)/);
  assert.match(view,/this\.commandesPro\.render\(meta, this\.binds, this\.files/);
  assert.match(view,/this\.onFootEditor\.render/);
  assert.match(view,/this\.backupCard\(\)/);
  assert.match(view,/private templateView\(/);
});
