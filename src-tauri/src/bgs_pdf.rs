// EDCH-BGS-PDF-v1.4.3
//! EDCH BGS PDF export: save the already-generated document to Documents/EDCH/rapports.
//! No user-supplied file path; creation is collision-safe; size and PDF envelope are checked.
use crate::paths::documents_dir;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_PDF_BYTES: usize = 8_000_000;

fn validate_pdf(data: &[u8]) -> Result<(), String> {
    if data.len() < 100 || data.len() > MAX_PDF_BYTES {
        return Err("bgsPdfInvalidSize".to_string());
    }
    if !data.starts_with(b"%PDF-") || !data[data.len().saturating_sub(1024)..]
        .windows(5)
        .any(|w| w == b"%%EOF")
    {
        return Err("bgsPdfInvalidData".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn bgs_save_pdf(data: Vec<u8>) -> Result<String, String> {
    validate_pdf(&data)?;
    let dir = documents_dir().join("rapports");
    fs::create_dir_all(&dir).map_err(|e| format!("bgsPdfCreateDir: {e}"))?;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    for suffix in 0..1000 {
        let name = format!("EDCH-BGS-rapport-{millis}-{suffix}.pdf");
        let path = dir.join(name);
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(&data).and_then(|_| file.sync_all()) {
                    let _ = fs::remove_file(&path);
                    return Err(format!("bgsPdfWrite: {e}"));
                }
                return Ok(path.to_string_lossy().to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("bgsPdfCreateFile: {e}")),
        }
    }
    Err("bgsPdfTooManyFiles".to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_pdf;
    #[test]
    fn refuses_html_or_short_pdf() {
        assert!(validate_pdf(b"<html>not PDF</html>").is_err());
        assert!(validate_pdf(b"%PDF-1.4\n%%EOF").is_err());
    }
    #[test]
    fn accepts_pdf_envelope() {
        let mut bytes = b"%PDF-1.4\n".to_vec();
        bytes.extend(vec![b'X'; 120]);
        bytes.extend(b"\n%%EOF\n");
        assert!(validate_pdf(&bytes).is_ok());
    }
}
