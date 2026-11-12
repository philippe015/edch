//! Local BGS SQLite storage. Independent of the core EDCH settings and commander keys.
//! The database is private to the current OS user, and no SQL text comes from the UI.
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::{AppHandle, Manager};

const MAX_SNAPSHOT_BYTES: usize = 8 * 1024 * 1024;
const MAX_FACTION_LENGTH: usize = 160;

fn connection(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db = dir.join("edch-bgs.sqlite3");
    let con = Connection::open(db).map_err(|e| e.to_string())?;
    con.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    con.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS bgs_snapshots (
           faction TEXT PRIMARY KEY NOT NULL,
           payload TEXT NOT NULL,
           saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS bgs_visits (
           system TEXT PRIMARY KEY NOT NULL,
           visited_at TEXT NOT NULL
         );",
    )
    .map_err(|e| e.to_string())?;
    Ok(con)
}

fn key(name: &str) -> Result<String, String> {
    let clean = name.trim().to_lowercase();
    if clean.is_empty() || clean.len() > MAX_FACTION_LENGTH || clean.contains('\0') {
        return Err("invalidBgsName".into());
    }
    Ok(clean)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BgsStored {
    snapshot: Option<String>,
    visits: Vec<BgsVisit>,
}

#[derive(Serialize)]
pub struct BgsVisit {
    system: String,
    at: String,
}

#[tauri::command]
pub fn bgs_load(app: AppHandle, faction: String) -> Result<BgsStored, String> {
    let faction = key(&faction)?;
    let con = connection(&app)?;
    let snapshot = con
        .query_row(
            "SELECT payload FROM bgs_snapshots WHERE faction=?1",
            params![faction],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let mut stmt = con
        .prepare("SELECT system, visited_at FROM bgs_visits ORDER BY system LIMIT 25000")
        .map_err(|e| e.to_string())?;
    let mapped = stmt
        .query_map([], |r| {
            Ok(BgsVisit {
                system: r.get(0)?,
                at: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let visits = mapped
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    Ok(BgsStored { snapshot, visits })
}

#[tauri::command]
pub fn bgs_save(app: AppHandle, faction: String, data: String) -> Result<(), String> {
    let faction = key(&faction)?;
    if data.len() > MAX_SNAPSHOT_BYTES {
        return Err("bgsSnapshotTooLarge".into());
    }
    let parsed: serde_json::Value = serde_json::from_str(&data).map_err(|_| "bgsInvalidJson".to_string())?;
    if parsed.get("faction").and_then(|s| s.as_str()).map(key).transpose()? != Some(faction.clone()) {
        return Err("bgsFactionMismatch".into());
    }
    if !parsed.get("systems").is_some_and(|v| v.is_array()) || !parsed.get("history").is_some_and(|v| v.is_array()) {
        return Err("bgsInvalidPayload".into());
    }
    let con = connection(&app)?;
    con.execute(
        "INSERT INTO bgs_snapshots(faction,payload) VALUES(?1,?2)
         ON CONFLICT(faction) DO UPDATE SET payload=excluded.payload, saved_at=CURRENT_TIMESTAMP",
        params![faction, data],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn bgs_visit(app: AppHandle, system: String, at: String) -> Result<(), String> {
    let system = key(&system)?;
    let valid_time = at.len() == 24
        && at.ends_with('Z')
        && at.as_bytes().get(4) == Some(&b'-')
        && at.as_bytes().get(10) == Some(&b'T');
    if !valid_time {
        return Err("bgsInvalidTimestamp".into());
    }
    let con = connection(&app)?;
    con.execute(
        "INSERT INTO bgs_visits(system,visited_at) VALUES(?1,?2)
         ON CONFLICT(system) DO UPDATE SET visited_at=excluded.visited_at
         WHERE excluded.visited_at > bgs_visits.visited_at",
        params![system, at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn bgs_health(app: AppHandle) -> Result<String, String> {
    let con = connection(&app)?;
    let check: String = con
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if check != "ok" {
        return Err("bgsDatabaseCorrupt".into());
    }
    Ok(check)
}
