//! EDCH Cyberpunk Philou v1.6.11 — local read-only storage inventory.
//! No arbitrary input paths, no deletion, no following symbolic links or remote access.
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MAX_ENTRIES: usize = 20_000;
const MAX_DEPTH: usize = 12;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageEntry {
    pub id: &'static str,
    pub label: &'static str,
    pub path: String,
    pub bytes: u64,
    pub files: u64,
    pub exists: bool,
    pub incomplete: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFileState {
    pub id: &'static str,
    pub name: &'static str,
    pub exists: bool,
    pub bytes: u64,
    pub modified_unix: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostic {
    pub entries: Vec<StorageEntry>,
    pub data_files: Vec<DataFileState>,
    pub agent_backups: u64,
    pub latest_agent_backup_unix: Option<u64>,
    pub checked_unix: u64,
}

fn modified_unix(time: Option<SystemTime>) -> Option<u64> {
    time.and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs())
}

fn walk_size(path: &Path) -> (u64, u64, bool, bool) {
    let Ok(base) = fs::symlink_metadata(path) else {
        return (0, 0, false, path.exists());
    };
    if base.file_type().is_symlink() {
        return (0, 0, false, true); // never inspect a symlink target
    }
    if base.is_file() {
        return (base.len(), 1, true, false);
    }
    if !base.is_dir() {
        return (0, 0, true, false);
    }
    let mut bytes = 0u64;
    let mut files = 0u64;
    let mut incomplete = false;
    let mut seen = 0usize;
    let mut stack: Vec<(PathBuf, usize)> = vec![(path.to_path_buf(), 0)];
    while let Some((dir, depth)) = stack.pop() {
        if depth > MAX_DEPTH {
            incomplete = true;
            continue;
        }
        let items = match fs::read_dir(&dir) {
            Ok(items) => items,
            Err(_) => {
                incomplete = true;
                continue;
            }
        };
        for item in items {
            if seen >= MAX_ENTRIES {
                incomplete = true;
                return (bytes, files, true, incomplete);
            }
            seen += 1;
            let Ok(item) = item else { incomplete = true; continue };
            let Ok(meta) = fs::symlink_metadata(item.path()) else {
                incomplete = true;
                continue;
            };
            if meta.file_type().is_symlink() { continue; }
            if meta.is_dir() {
                if depth >= MAX_DEPTH { incomplete = true; }
                else { stack.push((item.path(), depth + 1)); }
            } else if meta.is_file() {
                bytes = bytes.saturating_add(meta.len());
                files = files.saturating_add(1);
            }
        }
    }
    (bytes, files, true, incomplete)
}

fn entry(id: &'static str, label: &'static str, path: &Path) -> StorageEntry {
    let (bytes, files, exists, incomplete) = walk_size(path);
    StorageEntry {
        id, label, path: path.to_string_lossy().into_owned(),
        bytes, files, exists, incomplete,
    }
}

fn data_file(id: &'static str, name: &'static str, path: &Path) -> DataFileState {
    let meta = fs::symlink_metadata(path).ok().filter(|m| m.is_file() && !m.file_type().is_symlink());
    DataFileState {
        id, name, exists: meta.is_some(), bytes: meta.as_ref().map_or(0, |m| m.len()),
        modified_unix: meta.and_then(|m| modified_unix(m.modified().ok())),
    }
}

fn backup_stats(dir: &Path) -> (u64, Option<u64>) {
    let mut count = 0u64;
    let mut latest = None;
    let Ok(entries) = fs::read_dir(dir) else { return (0, None) };
    for candidate in entries.take(MAX_ENTRIES) {
        let Ok(candidate) = candidate else { continue };
        if !candidate.file_name().to_string_lossy().ends_with(".sqlite3") { continue; }
        let Ok(m) = fs::symlink_metadata(candidate.path()) else { continue };
        if !m.is_file() || m.file_type().is_symlink() { continue; }
        count += 1;
        if let Some(stamp) = modified_unix(m.modified().ok()) {
            latest = Some(latest.map_or(stamp, |old: u64| old.max(stamp)));
        }
    }
    (count, latest)
}

fn produce(executable: &Path, data: &Path, config: &Path, documents: &Path, bindings: Option<&Path>) -> StorageDiagnostic {
    let mut entries = vec![
        entry("program", "Exécutable Cyberpunk Philou", executable),
        entry("data", "Données locales EDCH (BGS, journaux et WebView)", data),
        entry("config", "Configuration EDCH", config),
        entry("reports", "Rapports et sauvegardes Documents/EDCH", documents),
    ];
    if let Some(bindings) = bindings {
        // Only scan the specific game's Bindings folder, never its full Steam library.
        entries.push(entry("bindings", "Commandes Elite Dangerous (.binds)", bindings));
    }
    let (agent_backups, latest_agent_backup_unix) = backup_stats(&data.join("agent-memory-backups"));
    StorageDiagnostic {
        entries,
        data_files: vec![
            data_file("bgs", "Base BGS SQLite", &data.join("edch-bgs.sqlite3")),
            data_file("agent", "Mémoire des agents SQLite", &data.join("edch-agent-memory-v153.sqlite3")),
        ],
        agent_backups,
        latest_agent_backup_unix,
        checked_unix: modified_unix(Some(SystemTime::now())).unwrap_or(0),
    }
}

#[tauri::command]
pub fn storage_diagnostic(app: AppHandle) -> Result<StorageDiagnostic, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let data = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let config = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let documents = crate::paths::documents_dir();
    // The game location comes from the existing read-only directory locator.
    let bindings = crate::options::options_dir().ok().map(|s| PathBuf::from(s).join("Bindings"));
    Ok(produce(&executable, &data, &config, &documents, bindings.as_deref()))
}

/// Run SQLite integrity check without creating a database, table, WAL or backup.
#[tauri::command]
pub fn storage_bgs_integrity(app: AppHandle) -> Result<String, String> {
    use rusqlite::{Connection, OpenFlags};
    let data = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let db = data.join("edch-bgs.sqlite3");
    let meta = fs::symlink_metadata(&db).map_err(|_| "bgsDatabaseMissing".to_string())?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err("bgsDatabaseUnsafe".into());
    }
    let con = Connection::open_with_flags(&db, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let check: String = con.query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if check != "ok" { return Err("bgsDatabaseCorrupt".into()); }
    Ok("ok".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_and_missing_paths_report_correctly() {
        let dir = std::env::temp_dir().join(format!("edch-storage-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("test.bin"), [1u8, 2, 3, 4]).unwrap();
        let (bytes, files, exists, incomplete) = walk_size(&dir);
        assert_eq!((bytes, files, exists, incomplete), (4, 1, true, false));
        assert_eq!(walk_size(&dir.join("missing")), (0, 0, false, false));
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn symbolic_links_are_never_followed() {
        use std::os::unix::fs::symlink;
        let dir = std::env::temp_dir().join(format!("edch-storage-linktest-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        symlink("/etc", dir.join("outside")).unwrap();
        assert_eq!(walk_size(&dir), (0, 0, true, false));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn absent_backups_are_not_described_as_existing() {
        let dir = std::env::temp_dir().join(format!("edch-storage-none-{}",std::process::id()));
        assert_eq!(backup_stats(&dir), (0, None));
    }
}
