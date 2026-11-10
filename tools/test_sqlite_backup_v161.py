"""SQLite WAL/transaction integration fixture, NOT a substitute for Rust/Tauri tests."""
import sqlite3
import tempfile
import unittest
from pathlib import Path

SCHEMA = '''
CREATE TABLE agent_memories (
 id INTEGER PRIMARY KEY, commander TEXT NOT NULL, faction TEXT NOT NULL,
 category TEXT NOT NULL, text TEXT NOT NULL, event_key TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX agent_memory_unique_event
ON agent_memories(commander,faction,event_key) WHERE event_key IS NOT NULL;
'''

class BackupTest(unittest.TestCase):
    def test_wal_snapshot_consistency_and_transaction_rollback(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            live = sqlite3.connect(root/'memory.sqlite3')
            live.execute('PRAGMA journal_mode=WAL')
            live.executescript(SCHEMA)
            live.execute("INSERT INTO agent_memories VALUES(1,'cmdr','faction','note','initial',NULL,'2026-11-10T00:00:00Z')")
            live.commit()
            backup = root/'backup.sqlite3'
            live.execute('VACUUM main INTO ?', (str(backup),))
            with sqlite3.connect(backup) as snap:
                self.assertEqual(snap.execute('PRAGMA quick_check').fetchone()[0], 'ok')
                self.assertEqual(snap.execute('SELECT text FROM agent_memories').fetchone()[0], 'initial')
            live.execute("INSERT INTO agent_memories VALUES(2,'cmdr','faction','note','new',NULL,'2026-11-10T01:00:00Z')")
            live.commit()
            # Force an error halfway into restoration: old rows must remain.
            with self.assertRaises(sqlite3.IntegrityError):
                with live:
                    live.execute('DELETE FROM agent_memories')
                    live.execute("INSERT INTO agent_memories VALUES(1,'cmdr','faction','note','restored',NULL,'2026-11-10T00:00:00Z')")
                    live.execute("INSERT INTO agent_memories VALUES(1,'cmdr','faction','note','duplicate',NULL,'2026-11-10T00:00:00Z')")
            self.assertEqual(live.execute('SELECT count(*) FROM agent_memories').fetchone()[0], 2)
            with sqlite3.connect(backup) as snap:
                with live:
                    live.execute('DELETE FROM agent_memories')
                    live.executemany('INSERT INTO agent_memories VALUES(?,?,?,?,?,?,?)',
                        snap.execute('SELECT id,commander,faction,category,text,event_key,created_at FROM agent_memories'))
            self.assertEqual(live.execute('SELECT text FROM agent_memories').fetchone()[0], 'initial')
            live.close()

if __name__ == '__main__': unittest.main()
