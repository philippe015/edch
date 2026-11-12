//! Updates from the GitHub releases of BKNadir/edch.
//!
//! check: compares the latest published release (or, if chosen in Settings, the newest
//! pre-release too) with this build's version.
//! download: fetches the NSIS installer of that release into %TEMP%\EDCH-update, reporting
//! progress, and checks its SHA-256 against the digest GitHub publishes for the asset.
//! install: starts that installer in passive mode with /R (it reopens EDCH once done) and
//! closes the app so its files can be replaced.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const REPO: &str = "philippe015/edch";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current: String,
    pub notes: String,
    pub page: String,
    pub asset: String,
    pub url: String,
    pub size: u64,
    pub digest: Option<String>,
}

#[derive(Serialize, Clone)]
struct Progress {
    done: u64,
    total: u64,
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(Duration::from_secs(60))
        .user_agent(concat!("EDCH/", env!("CARGO_PKG_VERSION")))
        .build()
}

/// "v1.2.3" / "1.2.3-beta" → (1, 2, 3)
fn parse_version(v: &str) -> Option<(u64, u64, u64)> {
    let core = v.trim().trim_start_matches(['v', 'V']).split(['-', '+']).next()?;
    let mut parts = core.split('.').map(|p| p.parse::<u64>().ok());
    Some((
        parts.next()??,
        parts.next().flatten().unwrap_or(0),
        parts.next().flatten().unwrap_or(0),
    ))
}

fn update_dir() -> PathBuf {
    std::env::temp_dir().join("EDCH-update")
}

/// Release order: (major, minor, patch, 1 for a release / 0 for a pre-release, pre-release run).
/// "v0.10.8-pre.64" → (0, 10, 8, 0, 64), "v0.10.8" → (0, 10, 8, 1, 0): a release comes after
/// its own pre-releases.
fn release_key(tag: &str) -> Option<(u64, u64, u64, u8, u64)> {
    let (major, minor, patch) = parse_version(tag)?;
    Some(match tag.trim().split_once('-') {
        None => (major, minor, patch, 1, 0),
        Some((_, pre)) => {
            let run = pre.rsplit('.').next().and_then(|n| n.parse().ok()).unwrap_or(0);
            (major, minor, patch, 0, run)
        }
    })
}

/// GitHub's answer as JSON; None when there is nothing (404: no release published yet).
fn github_json(url: &str) -> Result<Option<serde_json::Value>, String> {
    match agent().get(url).set("Accept", "application/vnd.github+json").call() {
        Ok(r) => Ok(Some(
            serde_json::from_str(&r.into_string().map_err(|e| e.to_string())?).map_err(|e| e.to_string())?,
        )),
        Err(ureq::Error::Status(404, _)) => Ok(None),
        Err(ureq::Error::Status(code, _)) => {
            crate::logs::warn("update", &format!("GitHub answered {code}"));
            Err(format!("githubStatus: {code}"))
        }
        Err(e) => Err(format!("network: {e}")),
    }
}

/// The architecture in this build's installer name ("EDCH_0.10.10_x64-setup.exe",
/// "EDCH_0.10.10_arm64-setup.exe").
const ARCH: &str = if cfg!(target_arch = "aarch64") {
    "_arm64-"
} else {
    "_x64-"
};

/// The release's Windows installer (NSIS) for this build's architecture, if it has one yet.
fn setup_asset(release: &serde_json::Value) -> Option<&serde_json::Value> {
    release["assets"].as_array().into_iter().flatten().find(|a| {
        a["name"].as_str().is_some_and(|n| {
            let n = n.to_lowercase();
            n.ends_with("-setup.exe") && n.contains(ARCH)
        })
    })
}

/// The newest release newer than this build, if any.
///
/// `pre_releases`: also consider pre-releases (Settings → Updates); when unticked on a
/// pre-release build, the latest release is offered even if older. `installed`: the tag this
/// build was published as ("v0.10.8-pre.64", from build-info.json or the updater), so a
/// pre-release build knows which one it is; ignored when it doesn't match this build's version.
#[tauri::command]
pub fn update_check(pre_releases: bool, installed: Option<String>) -> Result<Option<UpdateInfo>, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let mine = installed
        .filter(|tag| parse_version(tag) == parse_version(&current))
        .and_then(|tag| release_key(&tag))
        .or_else(|| release_key(&current));
    let releases: Vec<serde_json::Value> = if pre_releases {
        let url = format!("https://api.github.com/repos/{REPO}/releases?per_page=20");
        match github_json(&url)? {
            Some(serde_json::Value::Array(list)) => list,
            _ => Vec::new(),
        }
    } else {
        // GitHub's "latest" never returns drafts or pre-releases.
        let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
        github_json(&url)?.into_iter().collect()
    };
    let newest = releases
        .iter()
        .filter(|r| !r["draft"].as_bool().unwrap_or(false) && setup_asset(r).is_some())
        .filter_map(|r| release_key(r["tag_name"].as_str().unwrap_or_default()).map(|key| (key, r)))
        .max_by_key(|(key, _)| *key);
    let (Some((latest, release)), Some(mine)) = (newest, mine) else {
        return Ok(None);
    };
    // A newer one; or, on a pre-release build with pre-releases no longer wanted, the latest
    // release even if older (back to the stable version).
    let back_to_release = !pre_releases && mine.3 == 0;
    if latest <= mine && !back_to_release {
        return Ok(None);
    }
    let Some(asset) = setup_asset(release) else {
        return Ok(None);
    };
    let tag = release["tag_name"].as_str().unwrap_or_default();
    Ok(Some(UpdateInfo {
        version: tag.trim_start_matches(['v', 'V']).to_string(),
        current,
        notes: release["body"].as_str().unwrap_or_default().to_string(),
        page: release["html_url"].as_str().unwrap_or_default().to_string(),
        asset: asset["name"].as_str().unwrap_or_default().to_string(),
        url: asset["browser_download_url"].as_str().unwrap_or_default().to_string(),
        size: asset["size"].as_u64().unwrap_or(0),
        digest: asset["digest"].as_str().map(|d| d.to_string()),
    }))
}

fn download(app: &AppHandle, info: &UpdateInfo) -> Result<PathBuf, String> {
    let prefix = format!("https://github.com/{REPO}/releases/download/");
    if !info.url.starts_with(&prefix) {
        return Err(format!("addressRefused: {}", info.url));
    }
    let name = info.asset.replace(['/', '\\'], "_");
    if !name.to_lowercase().ends_with(".exe") {
        return Err("unexpectedFile".into());
    }
    let dir = update_dir();
    let _ = fs::remove_dir_all(&dir); // old downloads
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let target = dir.join(&name);
    let partial = dir.join(format!("{name}.part"));

    let response = agent().get(&info.url).call().map_err(|e| format!("download: {e}"))?;
    let total = response
        .header("Content-Length")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(info.size);
    let mut reader = response.into_reader();
    let mut file = File::create(&partial).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    let mut done: u64 = 0;
    let mut last_emit: u64 = 0;
    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("download: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        hasher.update(&buf[..n]);
        done += n as u64;
        if done - last_emit >= 256 * 1024 {
            last_emit = done;
            let _ = app.emit("update-progress", Progress { done, total });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    let _ = app.emit(
        "update-progress",
        Progress {
            done,
            total: total.max(done),
        },
    );

    if info.size > 0 && done != info.size {
        let _ = fs::remove_file(&partial);
        return Err("incompleteDownload".into());
    }
    if let Some(expected) = info.digest.as_deref().and_then(|d| d.strip_prefix("sha256:")) {
        let got: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        if !got.eq_ignore_ascii_case(expected) {
            let _ = fs::remove_file(&partial);
            return Err("checksumMismatch".into());
        }
    }
    fs::rename(&partial, &target).map_err(|e| e.to_string())?;
    Ok(target)
}

#[tauri::command]
pub async fn update_download(app: AppHandle, info: UpdateInfo) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download(&app, &info).map(|p| p.to_string_lossy().to_string()))
        .await
        .map_err(|e| e.to_string())?
}

/// Runs the downloaded installer (passive, reopens EDCH) and closes the app.
#[tauri::command]
pub fn update_install(app: AppHandle, path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let dir = update_dir();
    let inside = path.parent().map(|p| p == dir).unwrap_or(false);
    let is_exe = path.extension().map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false);
    if !inside || !is_exe || !path.is_file() {
        return Err("installerNotFound".into());
    }
    crate::logs::info("update", &format!("Running installer {}", path.display()));
    std::process::Command::new(&path)
        .args(["/UPDATE", "/P", "/R"])
        .spawn()
        .map_err(|e| format!("installFailed: {e}"))?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_version, release_key};

    #[test]
    fn versions() {
        assert_eq!(parse_version("v0.5.4"), Some((0, 5, 4)));
        assert_eq!(parse_version("1.2"), Some((1, 2, 0)));
        assert_eq!(parse_version("v1.0.0-beta.1"), Some((1, 0, 0)));
        assert!(parse_version("v0.5.10") > parse_version("v0.5.9"));
        assert_eq!(parse_version("nightly"), None);
    }

    #[test]
    fn releases_after_their_pre_releases() {
        assert!(release_key("v0.10.8-pre.65") > release_key("v0.10.8-pre.64"));
        assert!(release_key("v0.10.8") > release_key("v0.10.8-pre.66"));
        assert!(release_key("v0.10.9-pre.1") > release_key("v0.10.8"));
        assert!(release_key("v0.10.10-pre.2") > release_key("v0.10.9"));
    }
}
