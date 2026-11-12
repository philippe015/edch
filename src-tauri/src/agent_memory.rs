//! EDCH-COG-MEMORY-v1.5.3 — local per-commander/per-faction SQLite memory.
//! Does not modify the existing BGS database, Elite Dangerous journals, or binds.
use rusqlite::{params, Connection, OpenFlags};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri::{AppHandle, Manager};

const MAX_TEXT: usize = 2000;
const MAX_ITEMS_PER_SCOPE: i64 = 2000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRow {
    id: i64,
    category: String,
    text: String,
    event_key: Option<String>,
    created_at: String,
}

fn name(value: &str) -> Result<String, String> {
    let s = value.trim();
    if s.is_empty() || s.chars().count() > 160 || s.chars().any(char::is_control) {
        return Err("agentMemoryInvalidScope".into());
    }
    Ok(s.to_lowercase())
}

fn connection(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let con = Connection::open(dir.join("edch-agent-memory-v153.sqlite3")).map_err(|e| e.to_string())?;
    con.busy_timeout(std::time::Duration::from_millis(1500)).map_err(|e| e.to_string())?;
    con.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS agent_memories (
             id INTEGER PRIMARY KEY,
             commander TEXT NOT NULL,
             faction TEXT NOT NULL,
             category TEXT NOT NULL,
             text TEXT NOT NULL,
             event_key TEXT,
             created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         );
         CREATE INDEX IF NOT EXISTS agent_memory_scope ON agent_memories(commander,faction,id DESC);
         CREATE UNIQUE INDEX IF NOT EXISTS agent_memory_unique_event
           ON agent_memories(commander,faction,event_key) WHERE event_key IS NOT NULL;",
    ).map_err(|e| e.to_string())?;
    Ok(con)
}

#[tauri::command]
pub async fn agent_memory_add(
    app: AppHandle, commander: String, faction: String, category: String,
    text: String, event_key: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let commander = name(&commander)?;
        let faction = name(&faction)?;
        if !matches!(category.as_str(), "note" | "event" | "decision") {
            return Err("agentMemoryInvalidCategory".into());
        }
        let text = text.trim();
        if text.is_empty() || text.len() > MAX_TEXT || text.chars().any(|c| c == '\0') {
            return Err("agentMemoryInvalidText".into());
        }
        let key = event_key.map(|v| v.trim().to_string());
        if key.as_ref().is_some_and(|v| v.is_empty() || v.len() > 180 || !v.is_ascii()) {
            return Err("agentMemoryInvalidEventKey".into());
        }
        let mut con = connection(&app)?;
        let tx = con.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT OR IGNORE INTO agent_memories(commander,faction,category,text,event_key) VALUES(?1,?2,?3,?4,?5)",
            params![commander, faction, category, text, key],
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "DELETE FROM agent_memories WHERE commander=?1 AND faction=?2 AND id NOT IN
             (SELECT id FROM agent_memories WHERE commander=?1 AND faction=?2 ORDER BY id DESC LIMIT ?3)",
            params![commander, faction, MAX_ITEMS_PER_SCOPE],
        ).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn agent_memory_list(
    app: AppHandle, commander: String, faction: String, limit: usize,
) -> Result<Vec<MemoryRow>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let commander = name(&commander)?;
        let faction = name(&faction)?;
        let con = connection(&app)?;
        let mut stmt = con.prepare(
            "SELECT id, category, text, event_key, created_at FROM agent_memories
             WHERE commander=?1 AND faction=?2 ORDER BY id DESC LIMIT ?3",
        ).map_err(|e| e.to_string())?;
        let mapped = stmt.query_map(params![commander, faction, limit.min(100) as i64], |r| {
            Ok(MemoryRow { id: r.get(0)?, category: r.get(1)?, text: r.get(2)?,
                event_key: r.get(3)?, created_at: r.get(4)? })
        }).map_err(|e| e.to_string())?;
        mapped.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn agent_memory_delete(
    app: AppHandle, commander: String, faction: String, id: i64,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let commander = name(&commander)?;
        let faction = name(&faction)?;
        if id <= 0 { return Err("agentMemoryInvalidId".into()); }
        let con = connection(&app)?;
        let n = con.execute("DELETE FROM agent_memories WHERE id=?1 AND commander=?2 AND faction=?3",
            params![id,commander,faction]).map_err(|e| e.to_string())?;
        Ok(n > 0)
    }).await.map_err(|e| e.to_string())?
}


// EDCH-COG-STABILISATION-v1.6.1: consistent SQLite snapshots, never copy a WAL DB file directly.
const BACKUP_PREFIX: &str = "edch-agent-memory-backup-";
const BACKUP_SUFFIX: &str = ".sqlite3";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMemoryBackup {
    name: String,
    bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMemoryDiagnostic {
    healthy: bool,
    items: i64,
    backups: usize,
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let dir = base.join("agent-memory-backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if std::fs::symlink_metadata(&dir).map_err(|e| e.to_string())?.file_type().is_symlink() {
        return Err("agentMemoryUnsafeBackupDirectory".into());
    }
    Ok(dir)
}

fn backup_name_is_safe(name: &str) -> bool {
    name.len() > BACKUP_PREFIX.len() + BACKUP_SUFFIX.len() &&
        name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_SUFFIX) &&
        name[BACKUP_PREFIX.len()..name.len() - BACKUP_SUFFIX.len()].bytes()
            .all(|b| b.is_ascii_digit() || b == b'-')
}

fn inspect_backup(path: &Path) -> Result<(), String> {
    if !std::fs::symlink_metadata(path).map_err(|e| e.to_string())?.file_type().is_file() {
        return Err("agentMemoryUnsafeBackupFile".into());
    }
    let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let check: String = source.query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if check != "ok" { return Err("agentMemoryBackupCorrupt".into()); }
    let _: i64 = source.query_row("SELECT count(*) FROM agent_memories", [], |r| r.get(0))
        .map_err(|_| "agentMemoryBackupIncompatible".to_string())?;
    Ok(())
}

fn backup_snapshot(con: &Connection, dir: &Path) -> Result<AgentMemoryBackup, String> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?;
    let name = format!("{BACKUP_PREFIX}{}-{:09}{BACKUP_SUFFIX}", now.as_secs(), now.subsec_nanos());
    let path = dir.join(&name);
    // Reserve the filename with create_new: never overwrite a prior snapshot or follow a symlink.
    let reserved = std::fs::OpenOptions::new().write(true).create_new(true)
        .open(&path).map_err(|e| e.to_string())?;
    drop(reserved);
    // VACUUM INTO creates a transactionally consistent standalone DB (including WAL changes).
    // It fails safely if the destination is already occupied; the live DB is not changed.
    if let Err(error) = con.execute("VACUUM main INTO ?1", params![path.to_string_lossy().as_ref()]) {
        let _ = std::fs::remove_file(&path);
        return Err(error.to_string());
    }
    if let Err(error) = inspect_backup(&path) {
        let _ = std::fs::remove_file(&path);
        return Err(error);
    }
    Ok(AgentMemoryBackup { name, bytes: std::fs::metadata(path).map_err(|e| e.to_string())?.len() })
}

fn list_backups(dir: &Path) -> Result<Vec<AgentMemoryBackup>, String> {
    let mut items = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !backup_name_is_safe(&name) { continue; }
        let metadata = std::fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if metadata.file_type().is_file() { items.push(AgentMemoryBackup { name, bytes: metadata.len() }); }
    }
    items.sort_by(|a, b| b.name.cmp(&a.name));
    items.truncate(100); // bounded UI list; does not delete user backups.
    Ok(items)
}

#[tauri::command]
pub async fn agent_memory_backup(app: AppHandle) -> Result<AgentMemoryBackup, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let con = connection(&app)?;
        backup_snapshot(&con, &backups_dir(&app)?)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn agent_memory_backups(app: AppHandle) -> Result<Vec<AgentMemoryBackup>, String> {
    tauri::async_runtime::spawn_blocking(move || list_backups(&backups_dir(&app)?))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn agent_memory_diagnostic(app: AppHandle) -> Result<AgentMemoryDiagnostic, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let con = connection(&app)?;
        let check: String = con.query_row("PRAGMA quick_check", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let items: i64 = con.query_row("SELECT count(*) FROM agent_memories", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let backups = list_backups(&backups_dir(&app)?)?.len();
        Ok(AgentMemoryDiagnostic { healthy: check == "ok", items, backups })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn agent_memory_restore(app: AppHandle, name: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !backup_name_is_safe(&name) { return Err("agentMemoryUnsafeBackupName".into()); }
        let dir = backups_dir(&app)?;
        let target = dir.join(&name); // only a validated basename, never an arbitrary user path
        inspect_backup(&target)?;
        let source = Connection::open_with_flags(&target, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
        let mut con = connection(&app)?;
        // A separate, verified rollback snapshot is ALWAYS created before destructive work.
        backup_snapshot(&con, &dir)?;
        let tx = con.transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM agent_memories", []).map_err(|e| e.to_string())?;
        let mut count = 0usize;
        {
            let mut read = source.prepare(
                "SELECT id,commander,faction,category,text,event_key,created_at FROM agent_memories ORDER BY id")
                .map_err(|e| e.to_string())?;
            let mut insert = tx.prepare(
                "INSERT INTO agent_memories (id,commander,faction,category,text,event_key,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)")
                .map_err(|e| e.to_string())?;
            let mut rows = read.query([]).map_err(|e| e.to_string())?;
            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                insert.execute(params![
                    row.get::<_,i64>(0).map_err(|e| e.to_string())?,
                    row.get::<_,String>(1).map_err(|e| e.to_string())?,
                    row.get::<_,String>(2).map_err(|e| e.to_string())?,
                    row.get::<_,String>(3).map_err(|e| e.to_string())?,
                    row.get::<_,String>(4).map_err(|e| e.to_string())?,
                    row.get::<_,Option<String>>(5).map_err(|e| e.to_string())?,
                    row.get::<_,String>(6).map_err(|e| e.to_string())?,
                ]).map_err(|e| e.to_string())?;
                count += 1;
            }
        }
        // Any failure before commit rolls back everything: live DB cannot be half-restored.
        tx.commit().map_err(|e| e.to_string())?;
        Ok(count)
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn safe_snapshot_names() {
        assert!(backup_name_is_safe("edch-agent-memory-backup-1234567890-123456789.sqlite3"));
        assert!(!backup_name_is_safe("../edch-agent-memory-backup-1.sqlite3"));
        assert!(!backup_name_is_safe("edch-agent-memory-backup-1.sqlite3/../../other"));
    }
    #[test]
    fn scope_validation() {
        assert_eq!(name(" CMDR A ").unwrap(), "cmdr a");
        assert!(name("\n").is_err());
        assert!(name(&"x".repeat(161)).is_err());
    }
}
