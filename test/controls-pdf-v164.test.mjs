import test from 'node:test';
import assert from 'node:assert/strict';
import { buildControlsPdf } from '../dist/js/features/controls/controlsPdf.js';
const fixture={preset:'EDCH Test AZERTY',devices:[{device:'SaitekX52Pro',assigned:2,actions:2,axes:1,sharedInputs:0,catalogued:true}],overlaps:[],essentials:[{action:'HyperSuperCombination',bound:true}],translations:{boundActions:2,referenceFrench:1,toReview:['A/B \\(test)']}};
test('v1.6.4: report is an actual offline PDF with no scripts or remote payload',()=>{
  const pdf=buildControlsPdf(fixture);
  const bytes=new TextDecoder().decode(pdf);
  assert.ok(bytes.startsWith('%PDF-1.4'));
  assert.match(bytes,/\/Type \/Page/);
  assert.match(bytes,/SaitekX52Pro/);
  assert.match(bytes,/Cyberpunk Philou/);
  assert.ok(bytes.endsWith('%%EOF\n'));
  assert.ok(!bytes.includes('/JavaScript'));
});
test('v1.6.4: document pages are bounded even with thousands of rows',()=>{
  const many={...fixture,overlaps:Array.from({length:4000},(_,i)=>({device:'HOTAS',key:'Joy_'+i,group:'Ship',actions:['One','Two']}))};
  const bytes=new TextDecoder().decode(buildControlsPdf(many));
  assert.ok(bytes.length<100000);
});
