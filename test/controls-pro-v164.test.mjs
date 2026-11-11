import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditDevices, findInputOverlaps, compareBindProfiles, comparisonCsv,
  essentialChecks, auditFrenchReferences,
} from '../dist/js/features/controls/controlsPro.js';

const bind = (action, device, key, slot='primary', modifiers=[], inverted=false) => ({
  action, device, key, slot, modifiers, inverted,
});
const meta = {
  controls: {
    HyperSuperCombination: { g: 'Ship', n: 'Hyperspace', c: '', o: 1 },
    LandingGearToggle: { g: 'Ship', n: 'Landing Gear', c: '', o: 2 },
    FirePrimary: { g: 'Ship', n: 'Primary Fire', c: '', o: 3 },
    HumanoidJumpButton: { g: 'OnFoot', n: 'Jump', c: '', o: 4 },
  },
  devices: { SaitekX52Pro: { kind: 'joystick' }, Keyboard: { kind: 'keyboard' } },
  templates: {}, vidpid: {},
};

test('v1.6.4: inventory separates X52 Pro from keyboard, counts axes without claiming hardware detection', () => {
  const binds = [bind('HyperSuperCombination','SaitekX52Pro','Joy_1'),
    bind('FirePrimary','SaitekX52Pro','Joy_XAxis','axis'),
    bind('LandingGearToggle','Keyboard','Key_L')];
  const rows = auditDevices(binds, meta);
  assert.equal(rows.length, 2);
  const x52 = rows.find((r) => r.device === 'SaitekX52Pro');
  assert.equal(x52.axes, 1);
  assert.equal(x52.assigned, 2);
  assert.equal(x52.catalogued, true);
  assert.equal(rows.find((r) => r.device === 'Keyboard').axes, 0);
  assert.equal(binds[0].key, 'Joy_1');
});

test('v1.6.4: unknown HID identifier means uncatalogued, not disconnected', () => {
  const rows = auditDevices([bind('LandingGearToggle','06A314CC','Joy_3')], meta);
  assert.equal(rows[0].catalogued, false);
  assert.equal(rows[0].assigned, 1);
});

test('v1.6.4: shared input in same mode is a review hint, not a proven conflict', () => {
  const rows = [bind('FirePrimary','SaitekX52Pro','Joy_1'),bind('LandingGearToggle','SaitekX52Pro','Joy_1'),
    bind('HumanoidJumpButton','SaitekX52Pro','Joy_1')];
  const overlaps = findInputOverlaps(rows, (id) => meta.controls[id].g);
  assert.equal(overlaps.length, 1);
  assert.deepEqual(overlaps[0].actions,['FirePrimary','LandingGearToggle']);
  assert.equal(auditDevices(rows, meta)[0].sharedInputs, 1);
});

test('v1.6.4: modifier combos differ and reordered modifiers do not create false changes', () => {
  const orig = [bind('FirePrimary','SaitekX52Pro','Joy_4','primary', [
    {device:'Keyboard',key:'Key_A'},{device:'Keyboard',key:'Key_LeftAlt'}])];
  const copy = [bind('FirePrimary','SaitekX52Pro','Joy_4','primary', [
    {device:'Keyboard',key:'Key_LeftAlt'},{device:'Keyboard',key:'Key_A'}])];
  assert.deepEqual(compareBindProfiles(orig,copy), []);
  const different = [bind('FirePrimary','SaitekX52Pro','Joy_4','primary', [{device:'Keyboard',key:'Key_A'}])];
  assert.equal(compareBindProfiles(orig,different)[0].status,'changed');
});

test('v1.6.4: profile differences list changed, removed and added without changing inputs', () => {
  const a = [bind('FirePrimary','SaitekX52Pro','Joy_1'),bind('LandingGearToggle','Keyboard','Key_L')];
  const b = [bind('FirePrimary','SaitekX52Pro','Joy_2'),bind('HyperSuperCombination','Keyboard','Key_J')];
  const diff = compareBindProfiles(a,b);
  assert.equal(diff.length,3);
  assert.deepEqual(diff.map(x=>x.status).sort(),['added','changed','removed']);
  assert.equal(a[0].key,'Joy_1');
  assert.equal(b[0].key,'Joy_2');
});

test('v1.6.4: duplicate axis mapping counts and inversion changes are detected', () => {
  const a=[bind('FirePrimary','SaitekX52Pro','Joy_XAxis','axis',[],false)];
  const b=[bind('FirePrimary','SaitekX52Pro','Joy_XAxis','axis',[],true)];
  assert.equal(compareBindProfiles(a,b)[0].status,'changed');
  assert.match(compareBindProfiles(a,b)[0].after.join(''),/axe inversé/);
});

test('v1.6.4: checks only existing action IDs and does not imply game-wide mandatory bindings', () => {
  const checks=essentialChecks([bind('FirePrimary','SaitekX52Pro','Joy_1')],meta);
  assert.deepEqual(checks.map(x=>x.action).sort(), ['FirePrimary','HyperSuperCombination','LandingGearToggle']);
  assert.equal(checks.find(x=>x.action==='FirePrimary').bound,true);
  assert.equal(checks.find(x=>x.action==='LandingGearToggle').bound,false);
});

test('v1.6.4: audit distinguishes curated French labels from optional fallback labels', () => {
  const binds=[bind('FirePrimary','Keyboard','Key_A'),bind('LandingGearToggle','Keyboard','Key_L')];
  const result=auditFrenchReferences(binds, id=>meta.controls[id].n, name=>name==='Primary Fire'?'Tir principal':undefined);
  assert.equal(result.boundActions,2);
  assert.equal(result.referenceFrench,1);
  assert.deepEqual(result.toReview,['LandingGearToggle']);
});

test('v1.6.4: CSV export neutralizes injection and quotes, supports multiline', () => {
  const diff=[{action:'=HYPERLINK("bad")',slot:'primary',status:'added',before:[],after:['@SUM(1,2)','\n+2']}];
  const csv=comparisonCsv(diff,()=>'-WEBSERVICE("evil")');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"'-WEBSERVICE\(""evil""\)"/);
  assert.match(csv,/"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv,/"'@SUM\(1,2\)/);
});

test('v1.6.4: large malicious profile is bounded at 1500 differences', () => {
  const b=Array.from({length:2001},(_,i)=>bind('A'+i,'Keyboard','Key_A'));
  assert.equal(compareBindProfiles([],b).length,1500);
});
