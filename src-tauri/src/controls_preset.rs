//! EDCH v1.6.5: explicit, safe, offline creation of a new game-readable Odyssey .binds preset.
//! Never injects input into the game, changes StartPreset or overwrites any existing file.
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs::{self, OpenOptions}, io::Write, path::Path};

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

fn input_check(xml: &str, change: &ControlsChange) -> Result<(), String> {
    if !matches!(change.slot.as_str(), "primary"|"secondary") || !token(&change.action,100) {
        return Err("unknown or unsupported action/slot".into());
    }
    if !token(&change.device, 80) || !token(&change.key, 80) || change.modifiers.len() > 2 {
        return Err("invalid controller input".into());
    }
    if !known_input(xml, &change.device, &change.key)
        && !prepared_keyboard_key(&change.device, &change.key, &change.modifiers) {
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
    if changes.is_empty() || changes.len() > 40 {
        return Err("between 1 and 40 confirmed changes required".into());
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
    if changes.is_empty() || changes.len() > 40 { return Err("1–40 changes required".into()); }
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

#[cfg(test)]
mod tests {
    use super::*;
    const XML:&str=r#"<Root PresetName="Custom" MajorVersion="4" MinorVersion="2">
<YawLeftButton><Primary Device="Keyboard" Key="Key_A" /><Secondary Device="{NoDevice}" Key="" /></YawLeftButton>
<HyperSuperCombination><Primary Device="SaitekX52Pro" Key="Joy_1"><Modifier Device="Keyboard" Key="Key_A" /></Primary><Secondary Device="{NoDevice}" Key="" /></HyperSuperCombination>
<FirePrimary><Primary Device="SaitekX52Pro" Key="Joy_2" /><Secondary Device="{NoDevice}" Key="" /></FirePrimary>
</Root>"#;
    fn c() -> ControlsChange {ControlsChange{action:"YawLeftButton".into(),slot:"secondary".into(),device:"SaitekX52Pro".into(),key:"Joy_2".into(),modifiers:vec![],replace_existing:false}}
    #[test] fn new_slot_preserves_existing_hotkey(){let s=rewrite_xml(XML,"EDCHPro001",&c()).unwrap();assert!(s.contains("<Primary Device=\"Keyboard\" Key=\"Key_A\" />"));assert!(s.contains("<Secondary Device=\"SaitekX52Pro\" Key=\"Joy_2\" />"));assert!(s.contains("<HyperSuperCombination>"));}
    #[test] fn refuse_override_by_default(){let mut x=c();x.slot="primary".into();assert!(rewrite_xml(XML,"EDCHPro001",&x).is_err());x.replace_existing=true;assert!(rewrite_xml(XML,"EDCHPro001",&x).is_ok());}
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
