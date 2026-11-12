import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBgsAlerts, sanitizeAlertSettings, DEFAULT_ALERT_SETTINGS } from '../dist/js/features/bgs/alertRules.js';
import {
  alertScopeKey, emptyAlertState, loadAlertState, saveAlertState, captureNewAlerts,
  muteAlert, clearMutedAlerts, validAlertScope, sanitizeAlertState,
} from '../dist/js/features/bgs/alertStore.js';

const now = Date.parse('2026-11-10T12:00:00Z');
const settings = () => ({ ...DEFAULT_ALERT_SETTINGS });
const state = (systems, history = []) => ({ faction: '1ER ASTRA MILITARUM', systems, history });
const system = (fields = {}) => ({ name: 'Système A', states: [], source: 'Spansh', retrievedAt: '2026-11-10T11:00:00Z', ...fields });
const obs = (stamp, influence, controls = false, fields = {}) => ({
  key: 'système a', system: 'Système A', source: 'Spansh', observedAt: stamp,
  receivedAt: '2026-11-10T11:59:00Z', influence, controls, states: [], ...fields,
});
const old = '2026-11-08T09:00:00Z';
const latest = '2026-11-10T10:00:00Z';
const byKind = (alerts, kind) => alerts.filter(a => a.kind === kind);

// A community snapshot is not evidence of a tick. Never create an influence difference from one sample.
test('BGS alert v1.5.4: only two distinct Spansh observations produce an influence decline', () => {
  assert.equal(byKind(buildBgsAlerts(state([system()], [obs(latest, 20)]), settings(), now), 'influence').length, 0);
  assert.equal(byKind(buildBgsAlerts(state([system()], [obs(latest, 40), obs(latest, 20)]), settings(), now), 'influence').length, 0);
  const alerts = buildBgsAlerts(state([system()], [obs(old, 48), obs(latest, 40)]), settings(), now);
  const a = byKind(alerts, 'influence');
  assert.equal(a.length, 1);
  assert.match(a[0].text, /8\.0 points/);
  assert.match(a[0].text, /pas un tick confirmé/);
  assert.equal(a[0].observedChange, true);
});

test('BGS alert v1.5.4: manual data and future timestamps are never used as observed changes', () => {
  const manual = obs(latest, 20, false, { source: 'manual' });
  assert.equal(byKind(buildBgsAlerts(state([system()], [obs(old, 48), manual]), settings(), now), 'influence').length, 0);
  assert.equal(byKind(buildBgsAlerts(state([system()], [obs(old, 48), obs('2030-01-01T00:00:00Z', 20)]), settings(), now), 'influence').length, 0);
});

test('BGS alert v1.5.4: no alert from outdated or extremely distant measurement pair', () => {
  const stale = obs('2026-11-03T09:00:00Z', 20);
  const far = obs('2026-08-01T09:00:00Z', 48);
  assert.equal(byKind(buildBgsAlerts(state([system()], [obs('2026-11-01T09:00:00Z', 48), stale]), settings(), now), 'influence').length, 0);
  assert.equal(byKind(buildBgsAlerts(state([system()], [far, obs(latest, 20)]), settings(), now), 'influence').length, 0);
});

test('BGS alert v1.5.4: control loss and gain based on two distinct known observations', () => {
  const loss = byKind(buildBgsAlerts(state([system()], [obs(old, 45, true), obs(latest, 43, false)]), settings(), now), 'control');
  assert.equal(loss.length, 1);
  assert.equal(loss[0].severity, 'critical');
  assert.match(loss[0].text, /Contrôle perdu/);
  const gain = byKind(buildBgsAlerts(state([system()], [obs(old, 20, false), obs(latest, 25, true)]), settings(), now), 'control');
  assert.match(gain[0].text, /Contrôle acquis/);
});

test('BGS alert v1.5.4: fresh conflict states require a dated Spansh system, never manual', () => {
  const a = byKind(buildBgsAlerts(state([system({ states: ['War'], updatedAt: latest })]), settings(), now), 'conflict');
  assert.equal(a.length, 1);
  assert.match(a[0].text, /War/);
  assert.equal(byKind(buildBgsAlerts(state([system({ states: ['War'], updatedAt: '2026-11-01T00:00:00Z' })]), settings(), now), 'conflict').length, 0);
  assert.equal(byKind(buildBgsAlerts(state([system({ source: 'manual', states: ['War'], updatedAt: latest })]), settings(), now), 'conflict').length, 0);
});

test('BGS alert v1.5.4: repeated conflict updates on the same UTC day have the same key', () => {
  const earlier = buildBgsAlerts(state([system({ states: ['War'], updatedAt: '2026-11-10T08:00:00Z' })]), settings(), now);
  const later = buildBgsAlerts(state([system({ states: ['War'], updatedAt: '2026-11-10T10:00:00Z' })]), settings(), now);
  assert.equal(byKind(earlier, 'conflict')[0].id, byKind(later, 'conflict')[0].id);
});

test('BGS alert v1.5.4: overdue visits are labelled as recorded age, not absence in game', () => {
  const a = byKind(buildBgsAlerts(state([system({ lastVisitedAt: '2026-10-31T00:00:00Z' })]), settings(), now), 'patrol');
  assert.equal(a.length, 1);
  assert.equal(a[0].observedChange, false);
  assert.match(a[0].text, /pas une preuve d'absence en jeu/);
  assert.equal(byKind(buildBgsAlerts(state([system({ lastVisitedAt: latest })]), settings(), now), 'patrol').length, 0);
});

test('BGS alert v1.5.4: missing visits optional, never assume a historical visit occurred', () => {
  const s = state([system()]);
  assert.equal(byKind(buildBgsAlerts(s, settings(), now), 'unvisited').length, 0);
  assert.equal(byKind(buildBgsAlerts(s, { ...settings(), unvisited: true }, now), 'unvisited').length, 1);
});

test('BGS alert v1.5.4: stale Spansh timestamp alerts do not claim a tick or fabricate influence', () => {
  const s = state([system({ updatedAt: '2026-10-29T00:00:00Z' })]);
  const a = buildBgsAlerts(s, settings(), now);
  assert.equal(byKind(a, 'stale').length, 1);
  assert.equal(byKind(a, 'influence').length, 0);
  assert.equal(a[0].observedChange, false);
});

test('BGS alert v1.5.4: settings are clamped and invalid values cannot change defaults', () => {
  const s = sanitizeAlertSettings({ influenceDropPoints: -99, overdueDays: 1000, staleDays: NaN, sound: 'yes' });
  assert.equal(s.influenceDropPoints, 1);
  assert.equal(s.overdueDays, 60);
  assert.equal(s.staleDays, 7);
  assert.equal(s.sound, false);
});

test('BGS alert v1.5.4: no old alerts are notified on the first evaluation', () => {
  const a = buildBgsAlerts(state([system()], [obs(old, 48), obs(latest, 40)]), { ...settings(), notifications: true }, now);
  const init = { ...emptyAlertState(), settings: { ...settings(), notifications: true } };
  const first = captureNewAlerts(init, a);
  assert.equal(first.toNotify.length, 0);
  assert.equal(first.state.initialized, true);
  const again = captureNewAlerts(first.state, a);
  assert.equal(again.toNotify.length, 0);
  assert.equal(again.newlyObserved, 0);
});

test('BGS alert v1.5.4: two new real observed changes notify at most twice', () => {
  const init = { ...emptyAlertState(), settings: { ...settings(), notifications: true }, initialized: true };
  const alerts = [0, 1, 2, 3].map(i => ({
    id: 'observation' + i, kind: 'influence', severity: 'warning', system: 'S' + i,
    text: 'observed', observedChange: true,
  }));
  const out = captureNewAlerts(init, alerts);
  assert.equal(out.toNotify.length, 2);
  assert.equal(out.state.seen.length, 4);
  assert.equal(captureNewAlerts(out.state, alerts).toNotify.length, 0);
});

test('BGS alert v1.5.4: overdue and stale alerts never produce automatic notifications', () => {
  const alerts = buildBgsAlerts(state([system({ updatedAt: '2026-10-01T00:00:00Z', lastVisitedAt: '2026-10-01T00:00:00Z' })]), settings(), now);
  const result = captureNewAlerts({ ...emptyAlertState(), settings: { ...settings(), notifications: true }, initialized: true }, alerts);
  assert.equal(result.toNotify.length, 0);
  assert.equal(result.state.seen.length, 2);
});

test('BGS alert v1.5.4: ignored alerts can be restored', () => {
  const base = emptyAlertState();
  const muted = muteAlert(base, 'control:S:1:2');
  assert.deepEqual(muted.muted, ['control:S:1:2']);
  assert.deepEqual(clearMutedAlerts(muted).muted, []);
});

test('BGS alert v1.5.4: preferences isolated per CMDR and faction with local persistence', () => {
  const backing = new Map();
  const storage = { getItem: k => backing.get(k) ?? null, setItem: (k, v) => backing.set(k, v) };
  const a = { commander: 'PHILOU', faction: '1ER ASTRA MILITARUM' };
  const b = { commander: 'OTHER CMDR', faction: '1ER ASTRA MILITARUM' };
  const c = { commander: 'PHILOU', faction: 'Faction B' };
  assert.notEqual(alertScopeKey(a), alertScopeKey(b));
  assert.notEqual(alertScopeKey(a), alertScopeKey(c));
  const aa = { ...emptyAlertState(), settings: { ...settings(), notifications: true } };
  assert.equal(saveAlertState(a, aa, storage), true);
  assert.equal(loadAlertState(a, storage).state.settings.notifications, true);
  assert.equal(loadAlertState(b, storage).state.settings.notifications, false);
  assert.equal(loadAlertState(c, storage).state.settings.notifications, false);
});

test('BGS alert v1.5.4: restricted storage degrades to volatile mode, scope validation blocks secrets', () => {
  const a = { commander: 'PHILOU', faction: '1ER ASTRA MILITARUM' };
  assert.equal(saveAlertState(a, emptyAlertState(), null), false);
  assert.equal(loadAlertState(a, null).persistent, false);
  assert.equal(validAlertScope({ commander: 'PHILOU\u0000', faction: 'valid' }), false);
  assert.equal(sanitizeAlertState({ seen: ['a'.repeat(999)], muted: ['ok'], initialized: true }).seen.length, 0);
});
