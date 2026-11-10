import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ALERT_QUERY, selectAlertPage, exportAlertCsv } from '../dist/js/features/bgs/alertView.js';

const alert = (i, kind = 'stale', severity = 'info', system = `Système ${i}`) => ({
  id: String(i), kind, severity, system, text: `Horodatage ancien ${i} jours`, observedChange: false,
});
const query = (patch = {}) => ({ ...DEFAULT_ALERT_QUERY, ...patch });

test('v1.6.2: 305 alertes accessibles sans se limiter aux 80 premières', () => {
  const all = Array.from({ length: 305 }, (_, i) => alert(i));
  const first = selectAlertPage(all, query());
  assert.equal(first.total, 305);
  assert.equal(first.pages, 8);
  assert.equal(first.rows.length, 40);
  const last = selectAlertPage(all, query({ page: 8 }));
  assert.equal(last.rows.length, 25);
  assert.equal(last.rows.at(-1).id, '304');
  assert.equal(last.from, 281);
  assert.equal(last.to, 305);
  assert.equal(all.length, 305);
});

test('v1.6.2: navigation clamp pages without skipping alerts', () => {
  const items = Array.from({ length: 61 }, (_, i) => alert(i));
  assert.equal(selectAlertPage(items, query({ page: 999, pageSize: 20 })).page, 4);
  assert.equal(selectAlertPage(items, query({ page: -2 })).page, 1);
  assert.equal(selectAlertPage(items, query({ page: Number.NaN })).page, 1);
});

test('v1.6.2: search accent-insensitive for system and message', () => {
  const items = [alert(1, 'stale', 'info', 'Étoile A'), alert(2, 'control', 'critical', 'Système B')];
  assert.equal(selectAlertPage(items, query({ query: 'etoile' })).total, 1);
  assert.equal(selectAlertPage(items, query({ query: 'horodatage ANCIEN 2' })).rows[0].id, '2');
});

test('v1.6.2: kind and severity filters combine and preserve original order', () => {
  const items = [alert(3, 'control', 'critical'), alert(2, 'stale', 'info'), alert(1, 'control', 'critical')];
  const page = selectAlertPage(items, query({ kind: 'control', severity: 'critical' }));
  assert.deepEqual(page.rows.map((a) => a.id), ['3', '1']);
  assert.deepEqual(items.map((a) => a.id), ['3', '2', '1']);
});

test('v1.6.2: empty results preserve clear zero metrics', () => {
  const result = selectAlertPage([alert(1)], query({ query: 'inexistant', page: 9 }));
  assert.equal(result.total, 0);
  assert.equal(result.from, 0);
  assert.equal(result.to, 0);
  assert.equal(result.page, 1);
  assert.equal(result.pages, 1);
});

test('v1.6.2: CSV export sanitizes formulas and quotes', () => {
  const content = exportAlertCsv([{ ...alert(1), system: '=HYPERLINK("http://bad")', text: 'Ligne\n"de test"' }]);
  assert.ok(content.startsWith('\uFEFF'));
  assert.match(content, /"'=HYPERLINK\(""http:\/\/bad""\)"/);
  assert.match(content, /"Ligne\n""de test"""/);
});

test('v1.6.2: page-size invalid falls back to 40 without mutation', () => {
  const items = Array.from({ length: 50 }, (_, i) => alert(i));
  assert.equal(selectAlertPage(items, query({ pageSize: 1000000 })).rows.length, 40);
});
