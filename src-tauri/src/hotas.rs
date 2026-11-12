//! EDCH v1.6.7 HOTAS Studio: opt-in Linux joystick discovery and single-event capture.
//! No virtual input, no injection, no game configuration writes and no privileged operations.
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotasDevice {
    id: String,
    name: String,
    vendor: Option<String>,
    product: Option<String>,
    readable: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotasEvent {
    device_id: String,
    kind: String,
    /// Linux joydev numbering: ZERO based, not an Elite Dangerous .binds Key.
    input_index: u8,
    value: i16,
}

fn valid_js_id(id: &str) -> bool {
    id.len() >= 3 && id.len() <= 6 && id.starts_with("js") && id[2..].bytes().all(|b| b.is_ascii_digit())
}

#[cfg(target_os = "linux")]
mod linux {
    use super::{valid_js_id, HotasDevice, HotasEvent};
    use std::fs::{self, File};
    use std::io::Read;
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::FileTypeExt;
    use std::path::Path;
    use std::time::{Duration, Instant};

    #[repr(C)]
    struct PollFd { fd: i32, events: i16, revents: i16 }
    unsafe extern "C" { fn poll(fds: *mut PollFd, nfds: usize, timeout: i32) -> i32; }
    const POLLIN: i16 = 0x0001;
    const POLLERR: i16 = 0x0008;
    const POLLHUP: i16 = 0x0010;
    const JS_BUTTON: u8 = 0x01;
    const JS_AXIS: u8 = 0x02;
    const JS_INIT: u8 = 0x80;

    fn attr(path: &Path) -> Option<String> {
        fs::read_to_string(path).ok().map(|x| x.trim().to_string()).filter(|x| !x.is_empty())
    }

    pub fn devices() -> Result<Vec<HotasDevice>, String> {
        const SYS: &str = "/sys/class/input";
        let mut found = Vec::new();
        let Ok(entries) = fs::read_dir(SYS) else { return Ok(found) };
        for entry in entries.flatten() {
            let id = entry.file_name().to_string_lossy().into_owned();
            if !valid_js_id(&id) { continue; }
            let dir = entry.path().join("device");
            let dev = Path::new("/dev/input").join(&id);
            found.push(HotasDevice {
                id, name: attr(&dir.join("name")).unwrap_or_else(|| "Joystick Linux (nom inconnu)".into()),
                vendor: attr(&dir.join("id/vendor")),
                product: attr(&dir.join("id/product")),
                readable: File::open(dev).is_ok(),
            });
        }
        found.sort_by(|a, b| a.id.cmp(&b.id));
        found.truncate(24);
        Ok(found)
    }

    fn decode_event(buf: [u8; 8], kind: &str, device_id: &str) -> Option<HotasEvent> {
        let value = i16::from_le_bytes([buf[4], buf[5]]);
        let event_type = buf[6];
        let index = buf[7];
        if event_type & JS_INIT != 0 { return None; }
        let actual = event_type & 0x7f;
        if (kind == "button" && actual == JS_BUTTON && value == 1)
            || (kind == "axis" && actual == JS_AXIS && value.unsigned_abs() >= 12_000)
        {
            return Some(HotasEvent { device_id: device_id.to_string(), kind: kind.to_string(), input_index: index, value });
        }
        None
    }

    pub fn capture(device_id: &str, kind: &str, timeout_ms: u32) -> Result<HotasEvent, String> {
        if !valid_js_id(device_id) { return Err("Identifiant du périphérique invalide".into()); }
        if !matches!(kind, "button" | "axis") { return Err("Type d'événement non pris en charge".into()); }
        if !(500..=12_000).contains(&timeout_ms) { return Err("Délai de capture invalide".into()); }
        if !devices()?.iter().any(|d| d.id == device_id) { return Err("Périphérique déconnecté".into()); }
        let path = Path::new("/dev/input").join(device_id);
        let md = fs::metadata(&path).map_err(|e| format!("Périphérique inaccessible : {e}"))?;
        if !md.file_type().is_char_device() { return Err("Le périphérique n'est pas un joystick Linux".into()); }
        let mut file = File::open(&path).map_err(|e| format!("Accès refusé au joystick : {e}"))?;
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(timeout_ms as u64) {
            let remain = (timeout_ms as u64).saturating_sub(start.elapsed().as_millis() as u64);
            let mut pfd = PollFd { fd: file.as_raw_fd(), events: POLLIN, revents: 0 };
            let polled = unsafe { poll(&mut pfd, 1, remain.min(250) as i32) };
            if polled < 0 {
                let error = std::io::Error::last_os_error();
                if error.kind() == std::io::ErrorKind::Interrupted { continue; }
                return Err(format!("Erreur de lecture joystick : {error}"));
            }
            if pfd.revents & (POLLERR | POLLHUP) != 0 { return Err("Joystick déconnecté pendant la capture".into()); }
            if polled == 0 || pfd.revents & POLLIN == 0 { continue; }
            let mut data = [0u8; 8];
            file.read_exact(&mut data).map_err(|e| format!("Lecture de l'événement impossible : {e}"))?;
            if let Some(event) = decode_event(data, kind, device_id) { return Ok(event); }
        }
        Err("Aucune entrée détectée dans le délai imparti".into())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        fn event(value: i16, ty: u8, number: u8) -> [u8; 8] {
            let mut bytes = [0u8; 8];
            bytes[4..6].copy_from_slice(&value.to_le_bytes());
            bytes[6] = ty; bytes[7] = number; bytes
        }
        #[test]
        fn accept_button_press_not_release() {
            assert_eq!(decode_event(event(1, JS_BUTTON, 2), "button", "js0").unwrap().input_index, 2);
            assert!(decode_event(event(0, JS_BUTTON, 2), "button", "js0").is_none());
        }
        #[test]
        fn ignore_startup_and_wrong_kind() {
            assert!(decode_event(event(1, JS_BUTTON | JS_INIT, 2), "button", "js0").is_none());
            assert!(decode_event(event(1, JS_BUTTON, 2), "axis", "js0").is_none());
        }
        #[test]
        fn axis_has_threshold_and_signed_value() {
            assert!(decode_event(event(6000, JS_AXIS, 3), "axis", "js0").is_none());
            assert_eq!(decode_event(event(-21000, JS_AXIS, 3), "axis", "js0").unwrap().value, -21000);
        }
    }
}

#[tauri::command]
pub fn hotas_devices() -> Result<Vec<HotasDevice>, String> {
    #[cfg(target_os = "linux")]
    { linux::devices() }
    #[cfg(not(target_os = "linux"))]
    { Err("La capture matérielle HOTAS v1.6.7 est disponible uniquement sous Linux".into()) }
}

#[tauri::command]
pub async fn hotas_capture(device_id: String, kind: String, timeout_ms: u32) -> Result<HotasEvent, String> {
    if !valid_js_id(&device_id) { return Err("Identifiant joystick invalide".into()); }
    #[cfg(target_os = "linux")]
    { tauri::async_runtime::spawn_blocking(move || linux::capture(&device_id, &kind, timeout_ms))
        .await.map_err(|e| format!("Capture interrompue : {e}"))? }
    #[cfg(not(target_os = "linux"))]
    { let _ = (kind, timeout_ms); Err("La capture matérielle HOTAS v1.6.7 est disponible uniquement sous Linux".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn js_identifier_prevents_path_traversal() {
        for bad in ["", "js", "js-1", "jsA", "../js0", "event3", "js0/x", "js0123456789"] { assert!(!valid_js_id(bad)); }
        assert!(valid_js_id("js0")); assert!(valid_js_id("js17"));
    }
}
