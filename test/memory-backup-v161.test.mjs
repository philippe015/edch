import test from 'node:test';
import assert from 'node:assert/strict';

const invoked = [];
globalThis.window = { __TAURI__: { core: { invoke: async (cmd, args) => {
  invoked.push({ cmd, args });
  switch (cmd) {
    case 'agent_memory_backup': return { name: 'edch-agent-memory-backup-123-123456789.sqlite3', bytes: 1024 };
    case 'agent_memory_backups': return [{ name: 'edch-agent-memory-backup-123-123456789.sqlite3', bytes: 1024 }];
    case 'agent_memory_restore': return 5;
    case 'agent_memory_diagnostic': return { healthy: true, items: 5, backups: 1 };
    default: throw Error(`unexpected command ${cmd}`);
  }
} } } };
const api = await import('../dist/js/features/agent/memory.js');

test('v1.6.1 : sauvegarde, inventaire et diagnostic via commandes Tauri bornées', async () => {
  assert.equal((await api.memoryBackup()).bytes, 1024);
  assert.equal((await api.memoryBackups()).length, 1);
  assert.deepEqual(await api.memoryDiagnostic(), { healthy: true, items: 5, backups: 1 });
  assert.equal((await api.memoryRestore('edch-agent-memory-backup-123-123456789.sqlite3')), 5);
  assert.deepEqual(invoked.map((x) => x.cmd), [
    'agent_memory_backup', 'agent_memory_backups', 'agent_memory_diagnostic', 'agent_memory_restore',
  ]);
});
test('v1.6.1 : nom de sauvegarde malveillant refusé avant appel natif', async () => {
  const before = invoked.length;
  await assert.rejects(api.memoryRestore('../../secret.sqlite3'));
  await assert.rejects(api.memoryRestore('edch-agent-memory-backup-1.sqlite3/../data'));
  assert.equal(invoked.length, before);
});
