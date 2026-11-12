// EDCH-BGS-CUSTOM-v1
//! The game's journal: finds the journal folder, replays the latest journals at start-up, then
//! follows the newest one and streams its lines to the UI ("journal-batch" events). Also watches
//! the companion files the game rewrites (Status.json, Cargo.json…, "aux-file" events) and reads
//! the archive once at start-up for what outlives a session (scan_history).

use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter, Manager};

use crate::logs;
#[cfg(target_os = "linux")]
use crate::paths::proton_users;

/// Bumped every time a new watch starts, so an older watcher thread stops by itself.
#[derive(Default)]
pub struct WatchState {
    generation: AtomicU64,
}

#[derive(Clone, Serialize)]
struct JournalBatch {
    lines: Vec<String>,
    replay: bool,
    file: String,
}

#[derive(Clone, Serialize)]
struct WatchStatus {
    state: String,
    file: Option<String>,
    message: Option<String>,
}

#[derive(Clone, Serialize)]
struct AuxFile {
    name: String,
    content: String,
}

/// Companion files the game rewrites in place; the UI gets them whenever they change.
const AUX_FILES: [&str; 5] = [
    "ShipLocker.json",
    "Backpack.json",
    "Cargo.json",
    "Status.json",
    "Market.json",
];
const BATCH: usize = 2000;
const MAX_REPLAY_FILES: usize = 40;

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn journal_files(dir: &Path) -> Vec<(PathBuf, SystemTime)> {
    let mut files: Vec<(PathBuf, SystemTime)> = match fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("Journal.") && name.ends_with(".log") {
                    let modified = entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(SystemTime::UNIX_EPOCH);
                    Some((entry.path(), modified))
                } else {
                    None
                }
            })
            .collect(),
        Err(_) => Vec::new(),
    };
    files.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.cmp(&b.0)));
    files
}

/// Length of the prefix that ends with a newline: a line still being written is left for later.
fn complete_len(bytes: &[u8]) -> usize {
    bytes.iter().rposition(|&b| b == b'\n').map(|p| p + 1).unwrap_or(0)
}

fn split_lines(bytes: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(bytes)
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

fn has_materials_event(bytes: &[u8]) -> bool {
    let text = String::from_utf8_lossy(bytes);
    text.contains("\"event\":\"Materials\"") || text.contains("\"event\": \"Materials\"")
}

fn emit_status(app: &AppHandle, state: &str, file: Option<String>, message: Option<String>) {
    let text = format!(
        "{state} {} {}",
        file.as_deref().unwrap_or(""),
        message.as_deref().unwrap_or("")
    );
    if state == "error" {
        logs::warn("journal", text.trim());
    } else {
        logs::info("journal", text.trim());
    }
    let _ = app.emit(
        "journal-status",
        WatchStatus {
            state: state.to_string(),
            file,
            message,
        },
    );
}

fn emit_lines(app: &AppHandle, lines: Vec<String>, replay: bool, file: &str) {
    if logs::debug_enabled() && !lines.is_empty() {
        logs::debug(
            "journal",
            &format!(
                "{} line(s) from {file}{}",
                lines.len(),
                if replay { " (replay)" } else { "" }
            ),
        );
    }
    for chunk in lines.chunks(BATCH) {
        let _ = app.emit(
            "journal-batch",
            JournalBatch {
                lines: chunk.to_vec(),
                replay,
                file: file.to_string(),
            },
        );
    }
}

fn read_from(path: &Path, offset: &mut u64) -> std::io::Result<Vec<u8>> {
    let mut file = File::open(path)?;
    let len = file.metadata()?.len();
    if len < *offset {
        // Truncated or replaced: start over.
        *offset = 0;
    }
    file.seek(SeekFrom::Start(*offset))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    Ok(buffer)
}

fn check_aux(app: &AppHandle, dir: &Path, seen: &mut [Option<SystemTime>; 5]) {
    for (index, name) in AUX_FILES.iter().enumerate() {
        let path = dir.join(name);
        let modified = match fs::metadata(&path).and_then(|m| m.modified()) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if seen[index] == Some(modified) {
            continue;
        }
        if let Ok(bytes) = fs::read(&path) {
            let content = String::from_utf8_lossy(&bytes).to_string();
            // The game sometimes leaves the file empty for a moment while rewriting it.
            if content.trim().is_empty() || serde_json::from_slice::<serde_json::Value>(&bytes).is_err() {
                // The game can rewrite a companion JSON file in multiple writes.
                // Do not mark its mtime as seen until valid JSON arrives.
                continue;
            }
            seen[index] = Some(modified);
            let _ = app.emit(
                "aux-file",
                AuxFile {
                    name: name.to_string(),
                    content,
                },
            );
        }
    }
}

fn watch_loop(app: AppHandle, dir: PathBuf, generation: u64) {
    let state = app.state::<Arc<WatchState>>().inner().clone();
    let alive = || state.generation.load(Ordering::SeqCst) == generation;

    // 1. Replay: newest journals back to the last login (the "Materials" event).
    let files = journal_files(&dir);
    let mut replay: Vec<PathBuf> = Vec::new();
    for (path, _) in files.iter().rev().take(MAX_REPLAY_FILES) {
        replay.push(path.clone());
        if let Ok(bytes) = fs::read(path) {
            if has_materials_event(&bytes) {
                break;
            }
        }
    }
    replay.reverse();

    let mut current: Option<PathBuf> = None;
    let mut offset: u64 = 0;
    for path in &replay {
        if !alive() {
            return;
        }
        let bytes = fs::read(path).unwrap_or_default();
        let len = complete_len(&bytes);
        emit_lines(&app, split_lines(&bytes[..len]), true, &file_name(path));
        current = Some(path.clone());
        offset = len as u64;
    }

    let mut aux_seen: [Option<SystemTime>; 5] = [None, None, None, None, None];
    check_aux(&app, &dir, &mut aux_seen);

    if files.is_empty() {
        emit_status(&app, "waiting", None, Some("noJournalFiles".into()));
    } else {
        emit_status(&app, "live", current.as_deref().map(file_name), None);
    }

    // 2. Tail the newest journal; switch when the game starts a new one.
    let mut last_scan = Instant::now();
    while alive() {
        if let Some(path) = current.clone() {
            if let Ok(bytes) = read_from(&path, &mut offset) {
                let len = complete_len(&bytes);
                if len > 0 {
                    emit_lines(&app, split_lines(&bytes[..len]), false, &file_name(&path));
                    offset += len as u64;
                }
            }
        }

        if current.is_none() || last_scan.elapsed() >= Duration::from_millis(1500) {
            last_scan = Instant::now();
            if let Some((newest, _)) = journal_files(&dir).last() {
                if current.as_ref() != Some(newest) {
                    current = Some(newest.clone());
                    offset = 0;
                    emit_status(&app, "live", Some(file_name(newest)), None);
                }
            }
            check_aux(&app, &dir, &mut aux_seen);
        }

        thread::sleep(Duration::from_millis(250));
    }
}

/// Journal lines of the last `days` days whose event is one of `events`, oldest first. Used once at
/// start-up to rebuild what outlives a single session (missions, colonisation depots, unsold
/// exploration and exobiology data, Powerplay merits). Capped so a huge archive stays quick.
#[tauri::command]
pub async fn scan_history(dir: String, days: u64, events: Vec<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        const MAX_BYTES: u64 = 400 * 1024 * 1024;
        const MAX_LINES: usize = 200_000;
        let since = SystemTime::now()
            .checked_sub(Duration::from_secs(days.saturating_mul(86_400)))
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let needles: Vec<String> = events.iter().map(|e| format!("\"event\":\"{e}\"")).collect();
        let needles_spaced: Vec<String> = events.iter().map(|e| format!("\"event\": \"{e}\"")).collect();
        let mut files: Vec<(PathBuf, SystemTime)> = journal_files(Path::new(&dir))
            .into_iter()
            .filter(|(_, modified)| *modified >= since)
            .collect();
        // Newest first while budgeting, then put back in order.
        files.reverse();
        let mut budget = MAX_BYTES;
        let mut picked: Vec<PathBuf> = Vec::new();
        for (path, _) in files {
            let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if size > budget {
                break;
            }
            budget -= size;
            picked.push(path);
        }
        picked.reverse();
        let mut out: Vec<String> = Vec::new();
        for path in picked {
            let bytes = fs::read(&path).unwrap_or_default();
            let len = complete_len(&bytes);
            for line in split_lines(&bytes[..len]) {
                if needles.iter().any(|n| line.contains(n.as_str()))
                    || needles_spaced.iter().any(|n| line.contains(n.as_str()))
                {
                    out.push(line);
                }
            }
        }
        if out.len() > MAX_LINES {
            out.drain(..out.len() - MAX_LINES);
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn default_journal_dir() -> Option<String> {
    // Linux: the game runs through Steam's Proton; its "Windows" user folder is in the prefix.
    #[cfg(target_os = "linux")]
    {
        for user in proton_users() {
            let path = user
                .join("Saved Games")
                .join("Frontier Developments")
                .join("Elite Dangerous");
            if path.is_dir() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    let home = std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())?;
    let path = Path::new(&home)
        .join("Saved Games")
        .join("Frontier Developments")
        .join("Elite Dangerous");
    Some(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn start_journal(app: AppHandle, dir: String) -> Result<(), String> {
    let path = PathBuf::from(&dir);
    if !path.is_dir() {
        return Err(format!("folderNotFound: {dir}"));
    }
    let state = app.state::<Arc<WatchState>>().inner().clone();
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let handle = app.clone();
    thread::spawn(move || watch_loop(handle, path, generation));
    Ok(())
}

#[tauri::command]
pub fn read_aux_file(dir: String, name: String) -> Result<String, String> {
    if name.contains('/') || name.contains('\\') || !name.ends_with(".json") {
        return Err("fileNameRefused".into());
    }
    fs::read_to_string(Path::new(&dir).join(&name)).map_err(|e| e.to_string())
}
