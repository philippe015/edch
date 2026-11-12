// EDCH-BGS-CUSTOM-v1
//! The game's option files (key bindings, graphics): list, read, export to a zip in
//! Documents\\EDCH, and import from a zip (the current files are always backed up first). Only the
//! Bindings and Graphics folders, and only the file types the game uses, are ever touched.

use serde::Serialize;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::paths::documents_dir;
#[cfg(target_os = "linux")]
use crate::paths::proton_users;

#[derive(Serialize)]
pub struct OptionFile {
    folder: String,
    name: String,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
pub struct ImportReport {
    written: Vec<String>,
    skipped: Vec<String>,
    backup: String,
}

/// The two option folders EDCH manages, under %LOCALAPPDATA%.
const OPTION_FOLDERS: [&str; 2] = ["Bindings", "Graphics"];

fn options_root() -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        let found = proton_users()
            .into_iter()
            .map(|u| {
                u.join("AppData")
                    .join("Local")
                    .join("Frontier Developments")
                    .join("Elite Dangerous")
                    .join("Options")
            })
            .find(|p| p.is_dir());
        if let Some(p) = found {
            return Ok(p);
        }
    }
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|h| Path::new(&h).join(".local/share")))
        .map_err(|_| "optionsFolderNotFound".to_string())?;
    Ok(base
        .join("Frontier Developments")
        .join("Elite Dangerous")
        .join("Options"))
}

/// Only plain file names with the extensions the game uses; no paths, no tricks.
fn allowed_option_file(folder: &str, name: &str) -> bool {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return false;
    }
    let lower = name.to_lowercase();
    match folder {
        "Bindings" => lower.ends_with(".binds") || lower.ends_with(".start"),
        "Graphics" => lower.ends_with(".xml"),
        _ => false,
    }
}

fn unix_secs(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn options_dir() -> Result<String, String> {
    Ok(options_root()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_option_files() -> Result<Vec<OptionFile>, String> {
    let root = options_root()?;
    let mut out = Vec::new();
    for folder in OPTION_FOLDERS {
        let Ok(entries) = fs::read_dir(root.join(folder)) else {
            continue;
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if !allowed_option_file(folder, &name) {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) if m.is_file() => m,
                _ => continue,
            };
            out.push(OptionFile {
                folder: folder.to_string(),
                name,
                size: meta.len(),
                modified: meta.modified().map(unix_secs).unwrap_or(0),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn read_option_file(folder: String, name: String) -> Result<String, String> {
    if !OPTION_FOLDERS.contains(&folder.as_str()) || !allowed_option_file(&folder, &name) {
        return Err("fileRefused".into());
    }
    let bytes = fs::read(options_root()?.join(&folder).join(&name)).map_err(|e| e.to_string())?;
    // .binds files start with a UTF-8 BOM.
    let text = String::from_utf8_lossy(&bytes).to_string();
    Ok(text.trim_start_matches('\u{feff}').to_string())
}

fn write_zip(target: &Path, folders: &[&str]) -> Result<usize, String> {
    use std::io::Write;
    let root = options_root()?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let file = File::create(target).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut count = 0;
    for folder in folders {
        let Ok(entries) = fs::read_dir(root.join(folder)) else {
            continue;
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if !allowed_option_file(folder, &name) || !entry.path().is_file() {
                continue;
            }
            let bytes = fs::read(entry.path()).map_err(|e| e.to_string())?;
            zip.start_file(format!("{folder}/{name}"), options)
                .map_err(|e| e.to_string())?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(count)
}

/// Zips the Bindings (and optionally Graphics) folders into Documents\EDCH. Returns the file path.
#[tauri::command]
pub fn export_config(include_graphics: bool) -> Result<String, String> {
    let folders: Vec<&str> = if include_graphics {
        vec!["Bindings", "Graphics"]
    } else {
        vec!["Bindings"]
    };
    let target = documents_dir().join(format!("EDCH-config-{}.zip", unix_secs(SystemTime::now())));
    let count = write_zip(&target, &folders)?;
    if count == 0 {
        let _ = fs::remove_file(&target);
        return Err("nothingToExport".into());
    }
    Ok(target.to_string_lossy().to_string())
}

/// Restores a zip made by export_config (or any zip with Bindings/ and Graphics/ entries).
/// The current configuration is always backed up first.
#[tauri::command]
pub fn import_config(data: Vec<u8>) -> Result<ImportReport, String> {
    use std::io::Read as _;
    const MAX_ZIP_BYTES: usize = 16 * 1024 * 1024;
    const MAX_ENTRIES: usize = 128;
    const MAX_SINGLE: u64 = 2 * 1024 * 1024;
    const MAX_TOTAL: u64 = 12 * 1024 * 1024;
    if data.len() > MAX_ZIP_BYTES {
        return Err("zipTooLarge".into());
    }
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(data)).map_err(|e| format!("unreadableZip: {e}"))?;
    if archive.len() > MAX_ENTRIES {
        return Err("zipTooManyEntries".into());
    }
    let mut total_size: u64 = 0;
    let mut names = std::collections::HashSet::new();
    // Validate everything before touching the game's files.
    let mut files: Vec<(String, String, Vec<u8>)> = Vec::new();
    let mut skipped = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let full = entry.name().replace('\\', "/");
        let parts: Vec<&str> = full.split('/').filter(|p| !p.is_empty()).collect();
        // Accept "Bindings/x.binds" anywhere in the archive (e.g. "Options/Bindings/x.binds").
        let pair = parts
            .windows(2)
            .rev()
            .find(|w| OPTION_FOLDERS.contains(&w[0]))
            .map(|w| (w[0].to_string(), w[1].to_string()));
        match pair {
            Some((folder, name)) if parts.last() == Some(&name.as_str()) && allowed_option_file(&folder, &name) => {
                // Preflight limits before decompression, then enforce again on the stream.
                if entry.size() > MAX_SINGLE || total_size.saturating_add(entry.size()) > MAX_TOTAL {
                    return Err("zipExpandedTooLarge".into());
                }
                if !names.insert((folder.clone(), name.clone())) {
                    return Err("zipDuplicateFile".into());
                }
                let mut bytes = Vec::new();
                entry
                    .by_ref()
                    .take(MAX_SINGLE + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if bytes.len() as u64 > MAX_SINGLE {
                    return Err("zipExpandedTooLarge".into());
                }
                total_size = total_size.saturating_add(bytes.len() as u64);
                if total_size > MAX_TOTAL {
                    return Err("zipExpandedTooLarge".into());
                }
                files.push((folder, name, bytes));
            }
            _ => skipped.push(full),
        }
    }
    if files.is_empty() {
        return Err("zipWithoutSettings".into());
    }
    let backup = documents_dir()
        .join("sauvegardes")
        .join(format!("avant-import-{}.zip", unix_secs(SystemTime::now())));
    write_zip(&backup, &OPTION_FOLDERS)?;

    let root = options_root()?;
    let mut written = Vec::new();
    for (folder, name, bytes) in files {
        let dir = root.join(&folder);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(&name), bytes).map_err(|e| e.to_string())?;
        written.push(format!("{folder}/{name}"));
    }
    Ok(ImportReport {
        written,
        skipped,
        backup: backup.to_string_lossy().to_string(),
    })
}
