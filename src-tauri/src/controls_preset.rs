//! EDCH v1.6.5: explicit, safe, offline creation of a new game-readable Odyssey .binds preset.
//! Never injects input into the game, changes StartPreset or overwrites any existing file.
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs::{self, OpenOptions}, io::Write, path::{Path,PathBuf}, time::{SystemTime,UNIX_EPOCH}};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ControlsChange {
    pub action: String,
    pub slot: String,
    pub device: String,
    pub key: String,
    #[serde(default)]
    pub modifiers: Vec<ControlsModifier>,
    #[serde(default)]
    pub replace_existing: bool,
}
#[derive(Debug, Clone, Deserialize)]
pub struct ControlsModifier { pub device: String, pub key: String }
#[derive(Debug, Serialize)]
pub struct ControlsPresetResult { pub preset: String, pub filename: String, pub path: String }

fn token(input: &str, maximum: usize) -> bool {
    !input.is_empty() && input.len() <= maximum && input.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn filename_valid(input: &str) -> bool {
    input.len() <= 120 && input.ends_with(".binds") && !input.contains("..")
        && input.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}
fn attr(tag: &str, name: &str) -> Option<String> {
    let at = tag.find(&format!("{name}=\""))? + name.len() + 2;
    let end = at + tag[at..].find('"')?;
    Some(tag[at..end].to_string())
}
fn set_attr(tag: &str, name: &str, value: &str) -> Result<String, String> {
    let at = tag.find(&format!("{name}=\""))
        .ok_or_else(|| format!("attribute {name} missing"))? + name.len() + 2;
    let end = at + tag[at..].find('"').ok_or("invalid attribute")?;
    Ok(format!("{}{}{}", &tag[..at], value, &tag[end..]))
}
fn known_input(xml: &str, device: &str, key: &str) -> bool {
    xml.split('<').filter_map(|text| text.split_once('>').map(|x| x.0))
        .filter(|tag| ["Primary ", "Secondary ", "Binding "].iter().any(|start| tag.starts_with(start)))
        .any(|tag| attr(tag, "Device").as_deref() == Some(device) && attr(tag, "Key").as_deref() == Some(key))
}
// Exact keyboard keys used by the bundled AZERTY templates (not Elite defaults).
// Keep synchronized with src/features/controls/preparedKeys.ts.
const PREPARED_AZERTY_KEYS: &[&str] = &[
    "Key_Z", "Key_S", "Key_Q", "Key_D", "Key_R", "Key_F", "Key_J", "Key_L",
    "Key_H", "Key_T", "Key_M", "Key_N", "Key_V", "Key_Y", "Key_C", "Key_U",
    "Key_B", "Key_E", "Key_G", "Key_X", "Key_3", "Key_Space", "Key_Tab",
    "Key_LeftShift", "Key_LeftControl",
];
fn prepared_keyboard_key(device: &str, key: &str, modifiers: &[ControlsModifier]) -> bool {
    device == "Keyboard" && modifiers.is_empty() && PREPARED_AZERTY_KEYS.contains(&key)
}

/// Codes permitted by the v1.6.19 On Foot physical key capture UI.
 /// Hardware controller IDs and modifiers are intentionally not inferred.
fn captured_keyboard_key(device: &str, key: &str, modifiers: &[ControlsModifier]) -> bool {
    if device != "Keyboard" || !modifiers.is_empty() { return false; }
    let Some(code) = key.strip_prefix("Key_") else { return false; };
    if code.len() == 1 && code.bytes().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) { return true; }
    if let Some(function) = code.strip_prefix('F') {
        if let Ok(n) = function.parse::<u8>() {
            if (1..=12).contains(&n) && function == n.to_string() { return true; }
        }
    }
    if let Some(num) = code.strip_prefix("Numpad_") {
        return num.len() == 1 && num.bytes().all(|c| c.is_ascii_digit());
    }
    matches!(code,
        "Space" | "Tab" | "Enter" | "Backspace" | "Delete" | "Insert" |
        "Home" | "End" | "PageUp" | "PageDown" |
        "UpArrow" | "DownArrow" | "LeftArrow" | "RightArrow" |
        "LeftShift" | "RightShift" | "LeftControl" | "RightControl" |
        "LeftAlt" | "RightAlt"
    )
}
fn input_check(xml: &str, change: &ControlsChange) -> Result<(), String> {
    if !matches!(change.slot.as_str(), "primary"|"secondary") || !token(&change.action,100) {
        return Err("unknown or unsupported action/slot".into());
    }
    if !token(&change.device, 80) || !token(&change.key, 80) || change.modifiers.len() > 2 {
        return Err("invalid controller input".into());
    }
    if !known_input(xml, &change.device, &change.key)
        && !prepared_keyboard_key(&change.device, &change.key, &change.modifiers)
        && !captured_keyboard_key(&change.device, &change.key, &change.modifiers) {
        return Err("input not present in selected source preset; no synthetic HOTAS IDs".into());
    }
    let mut seen=HashSet::new();
    for m in &change.modifiers {
        if !token(&m.device, 80) || !token(&m.key, 80) || !known_input(xml, &m.device, &m.key)
            || !seen.insert((m.device.as_str(),m.key.as_str()))
            || (m.device == change.device && m.key == change.key) {
            return Err("invalid modifier or modifier not present in source".into());
        }
    }
    Ok(())
}
fn rewrite_slot(body: &str, change: &ControlsChange) -> Result<String, String> {
    let slot = if change.slot == "primary" { "Primary" } else { "Secondary" };
    let opening = format!("<{slot} ");
    let start = body.find(&opening).ok_or("source action has no selected binding slot")?;
    if body[start+opening.len()..].contains(&opening) { return Err("ambiguous duplicate slot".into()); }
    let tag_end = start + body[start..].find('>').ok_or("invalid slot")? + 1;
    let old = &body[start..tag_end];
    let old_dev = attr(old,"Device").ok_or("Device missing")?;
    let old_key = attr(old,"Key").ok_or("Key missing")?;
    if old_dev != "{NoDevice}" && !old_key.is_empty() && !change.replace_existing {
        return Err("occupied slot: explicit replacement confirmation required".into());
    }
    let open_new = set_attr(&set_attr(old,"Device",&change.device)?,"Key",&change.key)?;
    let empty = old.trim_end().ends_with("/>");
    let close = format!("</{slot}>");
    let (end, old_inner) = if empty { (tag_end, String::new()) } else {
        let e = tag_end + body[tag_end..].find(&close).ok_or("missing binding close")?;
        (e+close.len(), body[tag_end..e].to_string())
    };
    let mut kept=old_inner;
    while let Some(at)=kept.find("<Modifier") {
        let end=at+kept[at..].find('>').ok_or("invalid modifier")?+1;
        if !kept[at..end].trim_end().ends_with("/>") {return Err("nested modifier unsupported".into());}
        kept.replace_range(at..end,"");
    }
    let mods=change.modifiers.iter().map(|m| format!("<Modifier Device=\"{}\" Key=\"{}\" />",m.device,m.key)).collect::<Vec<_>>().join("\n");
    let replacement=if empty && change.modifiers.is_empty() {open_new} else {
        let tag=if empty {open_new.trim_end_matches("/>").trim_end().to_string()+">"} else {open_new};
        format!("{tag}{kept}\n{mods}\n{close}")
    };
    Ok(format!("{}{}{}",&body[..start],replacement,&body[end..]))
}
fn rewrite_xml(xml: &str, preset: &str, change: &ControlsChange) -> Result<String, String> {
    if xml.len() > 5_000_000 || xml.contains("<!DOCTYPE") || xml.contains("<!ENTITY") || !xml.contains("</Root>")
        || !token(preset,40) {return Err("unsafe, invalid or oversized binds XML".into());}
    let root_start=xml.find("<Root ").ok_or("Root missing")?;
    let root_end=root_start+xml[root_start..].find('>').ok_or("invalid Root")?+1;
    let root=&xml[root_start..root_end];
    if attr(root,"MajorVersion").as_deref() != Some("4") {return Err("Odyssey v4 binding format required".into());}
    input_check(xml,change)?;
    let action_open=format!("<{}>",change.action);
    let action_end=format!("</{}>",change.action);
    let at=xml.find(&action_open).ok_or("action not in selected profile")?;
    if xml[at+action_open.len()..].contains(&action_open) {return Err("duplicate action".into());}
    let body_start=at+action_open.len();
    let body_end=body_start+xml[body_start..].find(&action_end).ok_or("action not closed")?;
    let body=rewrite_slot(&xml[body_start..body_end],change)?;
    let revised=format!("{}{}{}",&xml[..body_start],body,&xml[body_end..]);
    let next_root=set_attr(root,"PresetName",preset)?;
    // The root tag cannot be inside an action. Replace a single, previously checked occurrence.
    let output=revised.replacen(root,&next_root,1);
    if output.len() > 5_000_000 {return Err("output too large".into());}
    Ok(output)
}

/// Creates a NEW preset in Elite Dangerous's Options/Bindings; user selects it in-game.
#[tauri::command]
pub async fn controls_save_preset(source_file: String, change: ControlsChange) -> Result<ControlsPresetResult,String> {
    // Do not change a live game's settings (including an open launcher), even under Proton.
    if !crate::app::game_running().await.is_empty() {
        return Err("Close Elite Dangerous and its launcher before generating a profile".into());
    }
    if !filename_valid(&source_file) {return Err("invalid source filename".into());}
    let base=Path::new(&crate::options::options_dir()?).join("Bindings");
    let path=base.join(&source_file);
    let meta=fs::symlink_metadata(&path).map_err(|e|e.to_string())?;
    if !meta.file_type().is_file() || meta.file_type().is_symlink() || meta.len()>5_000_000 {
        return Err("invalid/symlink/oversized source profile".into());
    }
    let xml=fs::read_to_string(&path).map_err(|e|e.to_string())?;
    let start=xml.find("<Root ").ok_or("Root missing")?;
    let end=start+xml[start..].find('>').ok_or("invalid Root")?+1;
    let root=&xml[start..end];
    let major=attr(root,"MajorVersion").ok_or("version missing")?;
    let minor=attr(root,"MinorVersion").ok_or("minor version missing")?;
    if major!="4" || minor.is_empty() || minor.len()>2 || !minor.bytes().all(|b|b.is_ascii_digit()) {
        return Err("unsupported Odyssey profile version".into());
    }
    for n in 1..=999 {
        let preset=format!("EDCHPro{n:03}");
        let filename=format!("{preset}.{major}.{minor}.binds");
        let dest=base.join(&filename);
        let changed=rewrite_xml(&xml,&preset,&change)?;
        let mut f=match OpenOptions::new().write(true).create_new(true).open(&dest) {
            Ok(f)=>f,
            Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,
            Err(e)=>return Err(e.to_string()),
        };
        if let Err(e)=f.write_all(changed.as_bytes()).and_then(|_|f.sync_all()) {
            drop(f);let _=fs::remove_file(&dest);return Err(e.to_string());
        }
        return Ok(ControlsPresetResult{preset,filename,path:dest.to_string_lossy().to_string()});
    }
    Err("EDCHPro profile namespace full".into())
}


/// Safely applies a reviewed list of changes to ONE new profile. Never edits the source.
fn rewrite_xml_batch(xml: &str, preset: &str, changes: &[ControlsChange]) -> Result<String, String> {
    if changes.is_empty() || changes.len() > 96 {
        return Err("between 1 and 96 confirmed changes required".into());
    }
    let mut used = HashSet::new();
    // Validate against the unchanged source before rewriting any slot.
    for change in changes {
        if !used.insert((change.action.as_str(), change.slot.as_str())) {
            return Err("duplicate modification of the same action and slot".into());
        }
        input_check(xml, change)?;
    }
    let mut result = xml.to_owned();
    for change in changes {
        // This strict operation can reject a candidate if an earlier edit removed its
        // sole known appearance: fail safely rather than inventing device inputs.
        result = rewrite_xml(&result, preset, change)?;
    }
    Ok(result)
}

/// Generates a new EDCHProNNN profile with all confirmed changes, in one create_new write.
#[tauri::command]
pub async fn controls_save_preset_batch(
    source_file: String,
    changes: Vec<ControlsChange>,
) -> Result<ControlsPresetResult, String> {
    if !crate::app::game_running().await.is_empty() {
        return Err("Close Elite Dangerous and launcher before generating a profile".into());
    }
    if !filename_valid(&source_file) { return Err("invalid source filename".into()); }
    if changes.is_empty() || changes.len() > 96 { return Err("1–96 changes required".into()); }
    let base = Path::new(&crate::options::options_dir()?).join("Bindings");
    let path = base.join(&source_file);
    let meta = fs::symlink_metadata(&path).map_err(|e|e.to_string())?;
    if !meta.file_type().is_file() || meta.file_type().is_symlink() || meta.len() > 5_000_000 {
        return Err("invalid, symlink or oversized source preset".into());
    }
    let xml = fs::read_to_string(&path).map_err(|e|e.to_string())?;
    let start = xml.find("<Root ").ok_or("Root missing")?;
    let end = start + xml[start..].find('>').ok_or("invalid Root")? + 1;
    let root = &xml[start..end];
    let major = attr(root, "MajorVersion").ok_or("version missing")?;
    let minor = attr(root, "MinorVersion").ok_or("minor missing")?;
    if major != "4" || minor.is_empty() || minor.len() > 2 || !minor.bytes().all(|b|b.is_ascii_digit()) {
        return Err("unsupported Odyssey profile version".into());
    }
    // Preflight the entire rewrite before creating any destination file.
    let validate = rewrite_xml_batch(&xml, "EDCHPro001", &changes)?;
    if validate.len() > 5_000_000 { return Err("profile too large".into()); }
    for n in 1..=999 {
        let preset = format!("EDCHPro{n:03}");
        let filename = format!("{preset}.{major}.{minor}.binds");
        let path = base.join(&filename);
        let changed = if n == 1 { validate.clone() } else { rewrite_xml_batch(&xml, &preset, &changes)? };
        let mut file = match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        };
        if let Err(e) = file.write_all(changed.as_bytes()).and_then(|_|file.sync_all()) {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err(e.to_string());
        }
        return Ok(ControlsPresetResult { preset, filename, path: path.to_string_lossy().to_string() });
    }
    Err("EDCHPro profile namespace full".into())
}

/// User-facing named presets avoid EDCHPro001, EDCHPro002... accumulation.
 /// Only names in EDCH_* namespace may be created or explicitly updated.
fn safe_named_preset(name: &str) -> bool {
    name.starts_with("EDCH_") && name.len() <= 40 && name.len() >= 6 &&
      name.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
}
fn set_french_keyboard_layout(xml: &str) -> Result<String, String> {
    let open = "<KeyboardLayout>";
    let close = "</KeyboardLayout>";
    let from = xml.find(open).ok_or("source has no KeyboardLayout tag")? + open.len();
    let end = from + xml[from..].find(close).ok_or("malformed KeyboardLayout")?;
    Ok(format!("{}fr-FR{}", &xml[..from], &xml[end..]))
}
/// Validate the exact output before saving. It is not enough to trust a successful write.
fn verify_named_output(xml: &str, preset: &str, changes: &[ControlsChange]) -> Result<(), String> {
    let open = xml.find("<Root ").ok_or("Root missing after rewrite")?;
    let end = open + xml[open..].find('>').ok_or("Root malformed after rewrite")? + 1;
    if attr(&xml[open..end], "PresetName").as_deref() != Some(preset) {
        return Err("output PresetName does not match filename".into());
    }
    for change in changes {
        let start_tag = format!("<{}>", change.action);
        let close_tag = format!("</{}>", change.action);
        let start = xml.find(&start_tag).ok_or("output action missing")? + start_tag.len();
        let end = start + xml[start..].find(&close_tag).ok_or("output action not closed")?;
        let body = &xml[start..end];
        let slot = if change.slot == "primary" {"Primary"} else {"Secondary"};
        let at = body.find(&format!("<{slot} ")).ok_or("output input slot missing")?;
        let tag_end = at + body[at..].find('>').ok_or("output input malformed")? + 1;
        let tag = &body[at..tag_end];
        if attr(tag,"Device").as_deref()!=Some(change.device.as_str())
          || attr(tag,"Key").as_deref()!=Some(change.key.as_str()) {
            return Err(format!("output key differs from planned assignment for {}",change.action));
        }
    }
    Ok(())
}
fn named_xml(source: &str, name: &str, changes: &[ControlsChange], french: bool) -> Result<String,String> {
    if !safe_named_preset(name) || changes.is_empty() || changes.len()>96 {
        return Err("invalid named preset or action count (1–96)".into());
    }
    let result = rewrite_xml_batch(source,name,changes)?;
    let result = if french {set_french_keyboard_layout(&result)?} else {result};
    verify_named_output(&result,name,changes)?;
    if result.len()>5_000_000 {return Err("named profile too large".into());}
    Ok(result)
}
fn owned_named_file(path: &Path, preset: &str) -> Result<(), String> {
    let info=fs::symlink_metadata(path).map_err(|e|e.to_string())?;
    if info.file_type().is_symlink() || !info.file_type().is_file() || info.len()>5_000_000 {
        return Err("existing named profile is unsafe, not a regular file or too large".into());
    }
    let data=fs::read_to_string(path).map_err(|e|e.to_string())?;
    let at=data.find("<Root ").ok_or("existing named profile has no Root")?;
    let end=at+data[at..].find('>').ok_or("malformed Root")?+1;
    let root=&data[at..end];
    if attr(root,"PresetName").as_deref()!=Some(preset)
      || attr(root,"MajorVersion").as_deref()!=Some("4") {
      return Err("existing file is not the requested EDCH profile; refusing overwrite".into());
    }
    Ok(())
}
fn unique_update_paths(base: &Path, preset: &str) -> Result<(PathBuf,PathBuf),String> {
    let backups=base.join("EDCH_Backups");
    if !backups.exists() {fs::create_dir(&backups).map_err(|e|e.to_string())?;}
    let info=fs::symlink_metadata(&backups).map_err(|e|e.to_string())?;
    if info.file_type().is_symlink() || !info.file_type().is_dir() {
        return Err("backup folder is not a real directory".into());
    }
    let tick=SystemTime::now().duration_since(UNIX_EPOCH)
       .map_err(|e|e.to_string())?.as_micros();
    for attempt in 0..100u32 {
        let temporary=base.join(format!(".EDCH_{preset}_{tick}_{attempt}.tmp"));
        let backup=backups.join(format!("{preset}_{tick}_{attempt}.binds.bak"));
        if !temporary.exists()&&!backup.exists(){return Ok((temporary,backup));}
    }
    Err("cannot allocate unique EDCH temporary/backup paths".into())
}
/// Create or intentionally update ONE stable, named preset. Updating archives the previous
/// EDCH-owned .binds before replacing it. Never touches Custom, HOTAS or EDCHPro legacy files.
#[tauri::command]
pub async fn controls_save_named_preset_batch(
    source_file: String,
    changes: Vec<ControlsChange>,
    preset_name: String,
    update_existing: bool,
    french_azerty: bool,
) -> Result<ControlsPresetResult,String> {
    if !crate::app::game_running().await.is_empty() {
        return Err("Close Elite Dangerous and its launcher before updating presets".into());
    }
    if !safe_named_preset(&preset_name) || !filename_valid(&source_file) {
        return Err("invalid profile name: expected EDCH_UPPERCASE_UNDERSCORES".into());
    }
    if changes.is_empty() || changes.len()>96 {return Err("1–96 reviewed changes required".into());}
    let base=Path::new(&crate::options::options_dir()?).join("Bindings");
    let source_path=base.join(&source_file);
    let meta=fs::symlink_metadata(&source_path).map_err(|e|e.to_string())?;
    if !meta.file_type().is_file() || meta.file_type().is_symlink() || meta.len()>5_000_000 {
        return Err("invalid, symlink or oversized source .binds".into());
    }
    let xml=fs::read_to_string(&source_path).map_err(|e|e.to_string())?;
    let at=xml.find("<Root ").ok_or("Root missing")?;
    let end=at+xml[at..].find('>').ok_or("malformed Root")?+1;
    let root=&xml[at..end];
    let major=attr(root,"MajorVersion").ok_or("version missing")?;
    let minor=attr(root,"MinorVersion").ok_or("minor version missing")?;
    if major!="4" || minor.len()>2 || minor.is_empty() ||
      !minor.bytes().all(|b|b.is_ascii_digit()) {
        return Err("unsupported Odyssey .binds version".into());
    }
    let filename=format!("{preset_name}.{major}.{minor}.binds");
    let destination=base.join(&filename);
    // Avoid duplicate in-game dropdown entries due to files with the same Root PresetName
    // but different Odyssey minor versions.
    for item in fs::read_dir(&base).map_err(|e|e.to_string())? {
        let item=item.map_err(|e|e.to_string())?;
        let file=item.file_name().to_string_lossy().into_owned();
        if file.starts_with(&format!("{preset_name}.")) && file.ends_with(".binds")
          && file!=filename {
            return Err(format!("Another Odyssey version of {preset_name} already exists: {file}. Archive it explicitly first."));
        }
    }
    let output=named_xml(&xml,&preset_name,&changes,french_azerty)?;
    let destination_exists=destination.exists() || fs::symlink_metadata(&destination).is_ok();
    if !destination_exists {
        let mut out=OpenOptions::new().write(true).create_new(true).open(&destination)
          .map_err(|e|e.to_string())?;
        if let Err(e)=out.write_all(output.as_bytes()).and_then(|_|out.sync_all()) {
            drop(out);let _=fs::remove_file(&destination);
            return Err(e.to_string());
        }
    } else {
        if !update_existing {return Err(format!("{preset_name} already exists. Confirm update and backup in EDCH."));}
        owned_named_file(&destination,&preset_name)?;
        let (temp,backup)=unique_update_paths(&base,&preset_name)?;
        let mut staged=OpenOptions::new().write(true).create_new(true).open(&temp)
          .map_err(|e|e.to_string())?;
        if let Err(e)=staged.write_all(output.as_bytes()).and_then(|_|staged.sync_all()) {
            drop(staged);let _=fs::remove_file(&temp);return Err(e.to_string());
        }
        drop(staged);
        // Rename the original to the backup directory before making the new file visible.
        if let Err(e)=fs::rename(&destination,&backup){
            let _=fs::remove_file(&temp);return Err(format!("backup failed: {e}"));
        }
        if let Err(e)=fs::rename(&temp,&destination){
            let restore=fs::rename(&backup,&destination);
            let _=fs::remove_file(&temp);
            return Err(format!("update failed: {e}; restore previous file: {restore:?}"));
        }
    }
    // Ensure bytes on disk match all proposed settings, not only the in-memory output.
    let written=fs::read_to_string(&destination).map_err(|e|e.to_string())?;
    verify_named_output(&written,&preset_name,&changes)?;
    if french_azerty && !written.contains("<KeyboardLayout>fr-FR</KeyboardLayout>") {
        return Err("French AZERTY layout not present in written profile".into());
    }
    Ok(ControlsPresetResult{preset:preset_name,filename,path:destination.to_string_lossy().to_string()})
}
#[derive(Debug,Serialize)]
pub struct LegacyArchiveResult {
    pub archived:Vec<String>,
    pub skipped:Vec<String>,
    pub backup_dir:String,
}
/// Match only the historical EDCHProNNN( N) numbered Odyssey names.
fn legacy_edch_filename(filename:&str)->Option<String> {
    let upper=filename.to_ascii_uppercase();
    let (stem,version)=upper.split_once('.')?;
    let tail=stem.strip_prefix("EDCHPRO")?;
    if !(3..=5).contains(&tail.len()) || !tail.bytes().all(|b|b.is_ascii_digit()) {
        return None;
    }
    let parts=version.split('.').collect::<Vec<_>>();
    if parts.len()!=3 || parts[0]!="4" || parts[2]!="BINDS"
      || parts[1].is_empty() || parts[1].len()>2 ||
      !parts[1].bytes().all(|b|b.is_ascii_digit()) {return None;}
    Some(stem.into())
}
/// Explicit, reversible cleanup of unused numeric EDCHPro profiles.
/// No Custom/HOTAS/Xbox profile may be moved, nor a selected/active EDCHPro profile.
#[tauri::command]
pub async fn controls_archive_legacy_presets(selected_file:String)->Result<LegacyArchiveResult,String> {
    if !crate::app::game_running().await.is_empty(){
        return Err("Close Elite Dangerous and its launcher before archiving profiles".into());
    }
    if !selected_file.is_empty() && !filename_valid(&selected_file){
        return Err("Invalid selected profile filename".into());
    }
    let base=Path::new(&crate::options::options_dir()?).join("Bindings");
    let mut active=HashSet::<String>::new();
    let mut found_start=false;
    for item in fs::read_dir(&base).map_err(|e|e.to_string())? {
        let entry=item.map_err(|e|e.to_string())?;
        let name=entry.file_name().to_string_lossy().into_owned();
        if name.eq_ignore_ascii_case("StartPreset.4.start")||
            name.eq_ignore_ascii_case("StartPreset.start"){
            let info=fs::symlink_metadata(entry.path()).map_err(|e|e.to_string())?;
            if !info.file_type().is_file() || info.file_type().is_symlink()||info.len()>50_000{
                return Err("Unsafe StartPreset file; refusing archival".into());
            }
            found_start=true;
            for line in fs::read_to_string(entry.path()).map_err(|e|e.to_string())?.lines(){
                active.insert(line.trim().trim_start_matches('\u{feff}').to_ascii_uppercase());
            }
        }
    }
    if !found_start {
        return Err("StartPreset not available: cannot prove which legacy profile is active".into());
    }
    let backups=base.join("EDCH_Backups");
    if !backups.exists(){fs::create_dir(&backups).map_err(|e|e.to_string())?;}
    let info=fs::symlink_metadata(&backups).map_err(|e|e.to_string())?;
    if info.file_type().is_symlink()||!info.file_type().is_dir() {
        return Err("Unsafe EDCH backup folder".into());
    }
    let now=SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|e|e.to_string())?.as_micros();
    let mut archived=Vec::<String>::new();
    let mut skipped=Vec::<String>::new();
    for item in fs::read_dir(&base).map_err(|e|e.to_string())? {
        let entry=item.map_err(|e|e.to_string())?;
        let name=entry.file_name().to_string_lossy().into_owned();
        let Some(preset)=legacy_edch_filename(&name) else {continue;};
        if name.eq_ignore_ascii_case(&selected_file)||active.contains(&preset) {
            skipped.push(format!("{name} : profil utilisé ou sélectionné"));continue;
        }
        if archived.len()>=100 {
            skipped.push("Limit of 100 legacy files reached".into());break;
        }
        if let Err(e)=owned_legacy_file(&entry.path(),&preset){
            skipped.push(format!("{name} : {e}"));continue;
        }
        let mut moved=false;
        for attempt in 0..100u32 {
            let backup=backups.join(format!("Legacy_{preset}_{now}_{attempt}.binds.bak"));
            if backup.exists(){continue;}
            fs::rename(entry.path(),&backup).map_err(|e|format!("Cannot archive {name}: {e}"))?;
            archived.push(name.clone());moved=true;break;
        }
        if !moved{skipped.push(format!("{name} : no unused backup filename"));}
    }
    Ok(LegacyArchiveResult{archived,skipped,
      backup_dir:backups.to_string_lossy().to_string()})
}
fn owned_legacy_file(path:&Path,preset:&str)->Result<(),String>{
    let m=fs::symlink_metadata(path).map_err(|e|e.to_string())?;
    if m.file_type().is_symlink()||!m.file_type().is_file()||m.len()>5_000_000{
        return Err("not a safe regular .binds file".into());
    }
    let xml=fs::read_to_string(path).map_err(|e|e.to_string())?;
    let at=xml.find("<Root ").ok_or("Root missing")?;
    let end=at+xml[at..].find('>').ok_or("Root malformed")?+1;
    let root=&xml[at..end];
    if !attr(root,"PresetName").map(|name|name.eq_ignore_ascii_case(preset)).unwrap_or(false)
      || attr(root,"MajorVersion").as_deref()!=Some("4"){
        return Err("PresetName does not match legacy filename".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    const XML:&str=r#"<Root PresetName="Custom" MajorVersion="4" MinorVersion="2">
<YawLeftButton><Primary Device="Keyboard" Key="Key_A" /><Secondary Device="{NoDevice}" Key="" /></YawLeftButton>
<HyperSuperCombination><Primary Device="SaitekX52Pro" Key="Joy_1"><Modifier Device="Keyboard" Key="Key_A" /></Primary><Secondary Device="{NoDevice}" Key="" /></HyperSuperCombination>
<FirePrimary><Primary Device="SaitekX52Pro" Key="Joy_2" /><Secondary Device="{NoDevice}" Key="" /></FirePrimary>
</Root>"#;
    fn c() -> ControlsChange {ControlsChange{action:"YawLeftButton".into(),slot:"secondary".into(),device:"SaitekX52Pro".into(),key:"Joy_2".into(),modifiers:vec![],replace_existing:false}}
    #[test]
    fn cleanup_accepts_only_legacy_numbered_edchpro_binds() {
        assert_eq!(legacy_edch_filename("EDCHPro001.4.2.binds").as_deref(),Some("EDCHPRO001"));
        assert_eq!(legacy_edch_filename("EDCHPRO0004.4.2.binds").as_deref(),Some("EDCHPRO0004"));
        for file in ["EDCH_PIED_AZERTY_POLY.4.2.binds","Custom.4.2.binds",
                     "SaitekX52Pro.4.2.binds","EDCHPro00.4.2.binds",
                     "EDCHPro0001.3.0.binds","EDCHPro001.4.2.binds.bak",
                     "../EDCHPro001.4.2.binds"] {
           assert!(legacy_edch_filename(file).is_none(),"dangerous archive match: {file}");
        }
    }
    #[test]
    fn stable_named_presets_reject_fake_or_unsafe_names() {
        for preset in ["EDCH_PIED_AZERTY_POLY","EDCH_PIED_AZERTY_COMBAT","EDCH_SRV_XBOX_NAV"] {
            assert!(safe_named_preset(preset), "expected safe name: {preset}");
        }
        for preset in ["EDCHPro001","Custom","EDCH_", "EDCH_path/evil",
                       "EDCH_é", "EDCH_PIED COMBAT"] {
            assert!(!safe_named_preset(preset));
        }
    }
    #[test]
    fn named_output_contains_expected_keys_and_french_layout() {
        let source=XML.replacen("<YawLeftButton>",
          "<KeyboardLayout>en-US</KeyboardLayout><YawLeftButton>",1);
        let changes=[c()];
        let output=named_xml(&source,"EDCH_PIED_AZERTY_COMBAT",&changes,true).unwrap();
        assert!(output.contains("EDCH_PIED_AZERTY_COMBAT"));
        assert!(output.contains("<KeyboardLayout>fr-FR</KeyboardLayout>"));
        verify_named_output(&output,"EDCH_PIED_AZERTY_COMBAT",&changes).unwrap();
        assert!(verify_named_output(&output,"EDCH_PIED_AZERTY_POLY",&changes).is_err());
    }
    #[test]
    fn named_profile_write_preflight_refuses_empty_or_invalid_data() {
        assert!(named_xml(XML,"EDCH_PIED_AZERTY_POLY",&[],false).is_err());
        assert!(named_xml(XML,"EDCH_PIED_AZERTY_POLY",&[c()],true).is_err());
        assert!(named_xml(XML,"Custom",&[c()],false).is_err());
    }
    #[test] fn new_slot_preserves_existing_hotkey(){let s=rewrite_xml(XML,"EDCHPro001",&c()).unwrap();assert!(s.contains("<Primary Device=\"Keyboard\" Key=\"Key_A\" />"));assert!(s.contains("<Secondary Device=\"SaitekX52Pro\" Key=\"Joy_2\" />"));assert!(s.contains("<HyperSuperCombination>"));}
    #[test] fn refuse_override_by_default(){let mut x=c();x.slot="primary".into();assert!(rewrite_xml(XML,"EDCHPro001",&x).is_err());x.replace_existing=true;assert!(rewrite_xml(XML,"EDCHPro001",&x).is_ok());}
    #[test] fn captured_keyboard_codes_are_strictly_bounded() {
        let xml = XML;
        let mut change = c();
        change.device = "Keyboard".into();
        change.modifiers.clear();
        for key in ["Key_A", "Key_0", "Key_9", "Key_F1", "Key_F12",
                    "Key_Numpad_8", "Key_Enter", "Key_Backspace", "Key_LeftArrow",
                    "Key_RightShift"] {
            change.key = key.into();
            assert!(input_check(xml, &change).is_ok(), "rejected captured key {key}");
        }
        for key in ["Key_F0", "Key_F13", "Key_Numpad_88", "Key_Unknown",
                    "Key_a", "Key_Period", "Joy_5"] {
            change.key = key.into();
            assert!(input_check(xml, &change).is_err(), "accepted unapproved {key}");
        }
        change.key = "Key_A".into();
        change.device = "GamePad".into();
        assert!(input_check(xml, &change).is_err(), "must not invent gamepad input");
        change.device = "Keyboard".into();
        change.modifiers.push(ControlsModifier{device:"Keyboard".into(), key:"Key_LeftShift".into()});
        assert!(input_check(xml, &change).is_err(), "must not invent combos");
    }
    #[test] fn prepared_azerty_key_is_allowed_without_prior_use() {
        let mut x=c();
        x.device="Keyboard".into();
        x.key="Key_Z".into();
        assert!(input_check(XML,&x).is_ok());
        x.key="Key_Unknown".into();
        assert!(input_check(XML,&x).is_err());
        x.key="Key_Z".into();
        x.modifiers.push(ControlsModifier{device:"Keyboard".into(),key:"Key_LeftShift".into()});
        assert!(input_check(XML,&x).is_err());
    }
        #[test] fn reject_unknown_controller_or_action(){let mut x=c();x.key="Joy_999".into();assert!(rewrite_xml(XML,"EDCHPro001",&x).is_err());x=c();x.action="UnknownAction".into();assert!(rewrite_xml(XML,"EDCHPro001",&x).is_err());}
    #[test] fn refuse_entities_and_injection(){let mut x=c();x.action="YawLeftButton><root".into();assert!(rewrite_xml(XML,"EDCHPro001",&x).is_err());assert!(rewrite_xml("<!DOCTYPE x>" ,"EDCHPro001",&c()).is_err());}
    #[test] fn no_overwrite_source_name(){assert!(!filename_valid("../Custom.4.2.binds"));assert!(!filename_valid("Custom/hi.binds"));}
    #[test] fn keep_other_modifiers(){let s=rewrite_xml(XML,"EDCHPro001",&c()).unwrap();assert!(s.contains("<Modifier Device=\"Keyboard\" Key=\"Key_A\" />"));}
    #[test]
    fn batch_two_changes_preserve_existing_primary_and_hotas() {
        let second = ControlsChange { action:"HyperSuperCombination".into(), slot:"secondary".into(),
          device:"Keyboard".into(),key:"Key_A".into(),modifiers:vec![],replace_existing:false };
        let result = rewrite_xml_batch(XML, "EDCHPro001", &[c(),second]).unwrap();
        assert!(result.contains("PresetName=\"EDCHPro001\""));
        assert!(result.contains("<Secondary Device=\"SaitekX52Pro\" Key=\"Joy_2\" />"));
        assert!(result.contains("<Secondary Device=\"Keyboard\" Key=\"Key_A\" />"));
        assert!(result.contains("<Primary Device=\"SaitekX52Pro\" Key=\"Joy_1\""));
    }
    #[test]
    fn batch_reject_duplicates_and_overlimit() {
        assert!(rewrite_xml_batch(XML,"EDCHPro001",&[c(),c()]).is_err());
        assert!(rewrite_xml_batch(XML,"EDCHPro001",&[]).is_err());
        assert!(rewrite_xml_batch(XML,"EDCHPro001",&vec![c();41]).is_err());
    }
    #[test]
    fn batch_rejects_unsupported_input_and_occupied_primary() {
        let mut unknown=c();unknown.key="Joy_999".into();
        assert!(rewrite_xml_batch(XML,"EDCHPro001",&[unknown]).is_err());
        let mut occupied=c();occupied.slot="primary".into();
        assert!(rewrite_xml_batch(XML,"EDCHPro001",&[occupied]).is_err());
    }

}
