// EDCH-ONFOOT-EDIT-v1.4.4 — create a NEW Odyssey .binds preset, never modify an existing one.
// Keyboard Primary/Secondary slots only. Entire original XML outside selected slots is preserved.
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FootChange {
    action: String,
    slot: String,
    key: String,
    #[serde(default)]
    modifiers: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct FootPresetResult {
    pub preset: String,
    pub filename: String,
    pub path: String,
    pub changes: usize,
}

fn valid_key(key: &str) -> bool {
    key.starts_with("Key_")
        && key.len() >= 5
        && key.len() <= 48
        && key[4..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn valid_action(action: &str) -> bool {
    action.len() < 100
        && action.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')
        && (action.starts_with("Humanoid") || action.ends_with("_Humanoid"))
}
fn attr(source: &str, name: &str) -> Option<String> {
    let prefix = format!("{name}=\"");
    let at = source.find(&prefix)? + prefix.len();
    let end = at + source[at..].find('"')?;
    Some(source[at..end].to_string())
}
fn set_attr(tag: &str, name: &str, value: &str) -> Result<String, String> {
    let search = format!("{name}=\"");
    let at = tag.find(&search).ok_or_else(|| format!("attribute {name} missing"))? + search.len();
    let end = at + tag[at..].find('"').ok_or("unterminated attribute")?;
    Ok(format!("{}{}{}", &tag[..at], value, &tag[end..]))
}
fn remove_modifiers(inner: &str) -> Result<String, String> {
    let mut text = inner.to_string();
    while let Some(at) = text.find("<Modifier") {
        let end = at + text[at..].find('>').ok_or("unterminated Modifier")? + 1;
        if !text[at..end].trim_end().ends_with("/>") {
            return Err("unsupported nested Modifier: not a self-closing tag".into());
        }
        text.replace_range(at..end, "");
    }
    Ok(text)
}

fn rewrite_slot(fragment: &str, change: &FootChange) -> Result<String, String> {
    let tag = if change.slot == "primary" { "Primary" } else { "Secondary" };
    let open = format!("<{tag}");
    let start = fragment.find(&open).ok_or_else(|| format!("slot {tag} missing"))?;
    let open_end = start + fragment[start..].find('>').ok_or("invalid slot open tag")? + 1;
    let original_tag = &fragment[start..open_end];
    if !original_tag.as_bytes().get(open.len()).is_some_and(|b| b.is_ascii_whitespace()) {
        return Err("invalid slot tag".into());
    }
    if fragment[open_end..].contains(&open) {
        return Err(format!("ambiguous duplicate {tag} slots"));
    }
    let current_device = attr(original_tag, "Device").ok_or("slot Device attribute missing")?;
    if current_device != "Keyboard" && current_device != "{NoDevice}" {
        return Err(format!("{tag} already uses {current_device}; choose an empty/keyboard slot to preserve HOTAS or mouse"));
    }
    let device = if change.key.is_empty() { "{NoDevice}" } else { "Keyboard" };
    let opening = set_attr(&set_attr(original_tag, "Device", device)?, "Key", &change.key)?;
    let is_single = opening.trim_end().ends_with("/>");
    let close = format!("</{tag}>");
    let (end, inside) = if is_single {
        (open_end, String::new())
    } else {
        let end_at = open_end + fragment[open_end..].find(&close).ok_or("missing slot close tag")?;
        (end_at + close.len(), remove_modifiers(&fragment[open_end..end_at])?)
    };
    let modifiers = change.modifiers.iter().map(|m| format!("<Modifier Device=\"Keyboard\" Key=\"{m}\" />")).collect::<Vec<_>>().join("\n");
    let replacement = if modifiers.is_empty() && is_single {
        opening
    } else {
        let opener = if is_single { opening[..opening.rfind("/>").ok_or("bad slot")?].trim_end().to_string() + ">" } else { opening };
        format!("{opener}{inside}\n{modifiers}\n{close}")
    };
    Ok(format!("{}{}{}", &fragment[..start], replacement, &fragment[end..]))
}

fn rewrite_one(xml: &str, change: &FootChange) -> Result<String, String> {
    if !valid_action(&change.action) || !matches!(change.slot.as_str(), "primary" | "secondary") {
        return Err("only Odyssey on-foot Primary/Secondary actions are permitted".into());
    }
    if !change.key.is_empty() && !valid_key(&change.key) {
        return Err("invalid keyboard key".into());
    }
    if (change.key.is_empty() && !change.modifiers.is_empty()) || change.modifiers.len() > 2 || change.modifiers.iter().any(|m| !valid_key(m) || !["Key_LeftControl","Key_RightControl","Key_LeftShift","Key_RightShift","Key_LeftAlt","Key_RightAlt"].contains(&m.as_str()) || m == &change.key) {
        return Err("invalid keyboard modifier".into());
    }
    let open = format!("<{}>", change.action);
    let close = format!("</{}>", change.action);
    let start = xml.find(&open).ok_or_else(|| format!("on-foot action not present in chosen file: {}", change.action))?;
    let data_start = start + open.len();
    let data_end = data_start + xml[data_start..].find(&close).ok_or("action not closed")?;
    if xml[data_end + close.len()..].contains(&open) {
        return Err("duplicate on-foot action tag in source".into());
    }
    let replacement = rewrite_slot(&xml[data_start..data_end], change)?;
    Ok(format!("{}{}{}", &xml[..data_start], replacement, &xml[data_end..]))
}

fn rewrite_preset(xml: &str, preset: &str, changes: &[FootChange]) -> Result<String, String> {
    if changes.is_empty() || changes.len() > 100 { return Err("1 to 100 edits required".into()); }
    if !xml.contains("</Root>") || xml.contains("<!DOCTYPE") || xml.contains("<!ENTITY") { return Err("unsupported binds XML".into()); }
    let start = xml.find("<Root ").ok_or("Root opening tag missing")?;
    let end = start + xml[start..].find('>').ok_or("Root opening tag invalid")? + 1;
    let head = &xml[start..end];
    if attr(head, "MajorVersion").as_deref() != Some("4") { return Err("Odyssey 4.x binding file required".into()); }
    let new_head = set_attr(head, "PresetName", preset)?;
    let mut out = format!("{}{}{}", &xml[..start], new_head, &xml[end..]);
    let mut seen = std::collections::HashSet::new();
    for change in changes {
        if !seen.insert((change.action.as_str(), change.slot.as_str())) { return Err("duplicate edit for same slot".into()); }
        out = rewrite_one(&out, change)?;
    }
    Ok(out)
}

/// Creates a new preset in the game's Bindings directory. Does not modify the original or StartPreset.
#[tauri::command]
pub async fn foot_save_preset(source_file: String, changes: Vec<FootChange>) -> Result<FootPresetResult, String> {
    if crate::app::game_running().await == "game" { return Err("Close Elite Dangerous before saving a .binds preset".into()); }
    if !source_file.ends_with(".binds") || source_file.contains("..") || source_file.len() > 120 ||
       !source_file.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)) {
        return Err("invalid source .binds filename".into());
    }
    let folder = Path::new(&crate::options::options_dir()?).join("Bindings");
    let source = folder.join(&source_file);
    let metadata = fs::symlink_metadata(&source).map_err(|e| e.to_string())?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() || metadata.len() > 5_000_000 {
        return Err("invalid or oversized source preset".into());
    }
    let xml = fs::read_to_string(&source).map_err(|e| e.to_string())?;
    let root_start = xml.find("<Root ").ok_or("no Root")?;
    let root_end = root_start + xml[root_start..].find('>').ok_or("bad Root")? + 1;
    let root = &xml[root_start..root_end];
    let major = attr(root, "MajorVersion").ok_or("no MajorVersion")?;
    let minor = attr(root, "MinorVersion").ok_or("no MinorVersion")?;
    if major != "4" || minor.len() > 2 || !minor.bytes().all(|b| b.is_ascii_digit()) {
        return Err("unsupported Odyssey version".into());
    }
    // Always make a new file; no existing input (including HOTAS) can be overwritten.
    for seq in 1..=999 {
        let preset = format!("EDCHFoot{seq:03}");
        let filename = format!("{preset}.{major}.{minor}.binds");
        let target = folder.join(&filename);
        if target.exists() { continue; }
        let changed = rewrite_preset(&xml, &preset, &changes)?;
        if changed.len() > 5_000_000 { return Err("edited preset too large".into()); }
        let mut handle = match OpenOptions::new().write(true).create_new(true).open(&target) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        };
        if let Err(error) = handle.write_all(changed.as_bytes()).and_then(|_| handle.sync_all()) {
            drop(handle);
            let _ = fs::remove_file(&target);
            return Err(error.to_string());
        }
        return Ok(FootPresetResult { preset, filename, path: target.to_string_lossy().to_string(), changes: changes.len() });
    }
    Err("EDCHFoot preset namespace exhausted".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    const XML: &str = r#"<?xml version="1.0"?><Root PresetName="Custom" MajorVersion="4" MinorVersion="2">
<YawLeftButton><Primary Device="Keyboard" Key="Key_A" /></YawLeftButton>
<HumanoidJumpButton><Primary Device="Keyboard" Key="Key_Space" /><Secondary Device="{NoDevice}" Key="" /></HumanoidJumpButton>
<HumanoidItemWheelButton><Primary Device="Keyboard" Key="Key_LeftAlt"><Hold Value="1" /><Modifier Device="Keyboard" Key="Key_LeftShift" /></Primary><Secondary Device="SaitekX52Pro" Key="Joy_12" /></HumanoidItemWheelButton>
</Root>"#;
    fn c(action: &str, slot: &str, key: &str) -> FootChange { FootChange { action: action.into(), slot: slot.into(), key: key.into(), modifiers: vec![] } }
    #[test] fn only_foot_changes_preserve_ship_and_x52() {
        let r = rewrite_preset(XML,"EDCHFoot001", &[c("HumanoidJumpButton","primary","Key_Z")]).unwrap();
        assert!(r.contains("<YawLeftButton><Primary Device=\"Keyboard\" Key=\"Key_A\""));
        assert!(r.contains("Device=\"SaitekX52Pro\" Key=\"Joy_12\""));
        assert!(r.contains("PresetName=\"EDCHFoot001\""));
        assert!(r.contains("<HumanoidJumpButton><Primary Device=\"Keyboard\" Key=\"Key_Z\""));
    }
    #[test] fn refuse_x52_overwrite() { assert!(rewrite_preset(XML,"EDCHFoot001", &[c("HumanoidItemWheelButton","secondary","Key_T")]).is_err()); }
    #[test] fn preserve_hold_clear_old_modifier() {
        let r = rewrite_preset(XML,"EDCHFoot001", &[c("HumanoidItemWheelButton","primary","Key_G")]).unwrap();
        assert!(r.contains("<Hold Value=\"1\" />"));
        assert!(!r.contains("<Modifier Device"));
    }
    #[test] fn reject_ship_edit() { assert!(rewrite_preset(XML,"EDCHFoot001", &[c("YawLeftButton","primary","Key_G")]).is_err()); }
    #[test] fn reject_duplicate_edit() {
        let c=c("HumanoidJumpButton","primary","Key_Z");
        assert!(rewrite_preset(XML,"EDCHFoot001", &[c.clone(),c]).is_err());
    }
    #[test] fn reject_unknown_action() { assert!(rewrite_preset(XML,"EDCHFoot001", &[c("HumanoidImpossibleButton","primary","Key_G")]).is_err()); }
    #[test] fn accept_modifier_combo() {
        let mut change=c("HumanoidJumpButton","secondary","Key_G"); change.modifiers=vec!["Key_LeftControl".into()];
        let r=rewrite_preset(XML,"EDCHFoot001", &[change]).unwrap();
        assert!(r.contains("<Secondary Device=\"Keyboard\" Key=\"Key_G\" >") || r.contains("<Secondary Device=\"Keyboard\" Key=\"Key_G\">") );
        assert!(r.contains("<Modifier Device=\"Keyboard\" Key=\"Key_LeftControl\" />"));
    }
}
