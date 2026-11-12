// EDCH-BGS-RELIABILITY-v1.4.9
//! Save a validated BGS JSON snapshot via the desktop backend. No WebKit blob download.
//! Path is fixed under Documents/EDCH/sauvegardes-bgs and never comes from the UI.
use crate::paths::documents_dir;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_BACKUP_BYTES: usize = 8_000_000;

fn validate_snapshot(snapshot: &str) -> Result<(), String> {
    if snapshot.is_empty() || snapshot.len() > MAX_BACKUP_BYTES {
        return Err("bgsBackupInvalidSize".into());
    }
    let data: serde_json::Value = serde_json::from_str(snapshot).map_err(|_| "bgsBackupInvalidJson")?;
    let faction = data.get("faction").and_then(|v| v.as_str()).unwrap_or("");
    if faction.trim().is_empty() || faction.len() > 256 {
        return Err("bgsBackupInvalidFaction".into());
    }
    let systems = data.get("systems").and_then(|v| v.as_array()).ok_or("bgsBackupInvalidSystems")?;
    let history = data.get("history").and_then(|v| v.as_array()).ok_or("bgsBackupInvalidHistory")?;
    if systems.len() > 5000 || history.len() > 10000 {
        return Err("bgsBackupTooManyRows".into());
    }
    Ok(())
}

#[tauri::command]
pub fn bgs_save_json(snapshot: String) -> Result<String, String> {
    validate_snapshot(&snapshot)?;
    let dir = documents_dir().join("sauvegardes-bgs");
    fs::create_dir_all(&dir).map_err(|e| format!("bgsBackupCreateDir: {e}"))?;
    // BGS snapshots contain locally observed commander data: private to the local user.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("bgsBackupPermissions: {e}"))?;
    }
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    for counter in 0..1000 {
        let dest = dir.join(format!("EDCH-BGS-{ms}-{counter}.json"));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&dest) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(snapshot.as_bytes()).and_then(|_| file.sync_all()) {
                    drop(file);
                    let _ = fs::remove_file(&dest);
                    return Err(format!("bgsBackupWrite: {e}"));
                }
                return Ok(dest.to_string_lossy().to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("bgsBackupCreateFile: {e}")),
        }
    }
    Err("bgsBackupFileLimit".into())
}

#[cfg(test)]
mod tests {
    use super::validate_snapshot;
    #[test]
    fn refuses_invalid_and_unbounded_data() {
        assert!(validate_snapshot("not json").is_err());
        assert!(validate_snapshot(r#"{"faction":"","systems":[],"history":[]}"#).is_err());
        assert!(validate_snapshot(r#"{"faction":"Test","systems":{},"history":[]}"#).is_err());
        assert!(validate_snapshot(&"x".repeat(8_000_001)).is_err());
    }
    #[test]
    fn accepts_valid_snapshot() {
        assert!(validate_snapshot(r#"{"faction":"1ER ASTRA MILITARUM","systems":[],"history":[]}"#).is_ok());
    }
}
