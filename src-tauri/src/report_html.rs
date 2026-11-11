//! EDCH v1.6.5: native saving of standalone, sanitized HTML reports (no PDF MIME mismatch).
use crate::paths::documents_dir;
use std::{fs::{self,OpenOptions},io::Write,time::{SystemTime,UNIX_EPOCH}};
const MAX:usize=8_000_000;
fn validate_html(html:&str,kind:&str)->Result<(),String>{
  if !matches!(kind,"bgs"|"commandes") {return Err("invalid HTML report category".into());}
  if html.len()<170 || html.len()>MAX {return Err("invalid HTML report size".into());}
  let lower=html.to_ascii_lowercase();
  if !lower.starts_with("<!doctype html>") || !lower.contains("<html ") || !lower.contains("</html>")
      || !lower.contains("content-security-policy") || !lower.contains("default-src 'none'")
      || lower.contains("<script") || lower.contains("<iframe") || lower.contains("<object")
      || lower.contains("<embed") || lower.contains("<base ") {
    return Err("HTML must be standalone and script-free with restrictive CSP".into());
  }
  Ok(())
}
#[tauri::command]
pub fn save_html_report(kind:String,html:String)->Result<String,String>{
  validate_html(&html,&kind)?;
  let folder=documents_dir().join("rapports");
  fs::create_dir_all(&folder).map_err(|e|format!("reportHtmlDir: {e}"))?;
  let now=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_millis();
  for idx in 0..1000 {
    let name=format!("EDCH-{kind}-rapport-{now}-{idx}.html");
    let path=folder.join(name);
    match OpenOptions::new().create_new(true).write(true).open(&path) {
      Ok(mut file)=>{
        if let Err(e)=file.write_all(html.as_bytes()).and_then(|_|file.sync_all()){
          drop(file);let _=fs::remove_file(&path);return Err(format!("reportHtmlWrite: {e}"));
        }
        return Ok(path.to_string_lossy().to_string());
      }
      Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,
      Err(e)=>return Err(format!("reportHtmlCreate: {e}"))
    }
  }
  Err("too many HTML reports".into())
}
#[cfg(test)] mod tests{
  use super::*;
  #[test]fn refuse_html_without_csp(){assert!(validate_html("<html><script>alert(1)</script></html>","bgs").is_err());}
  #[test]fn refuse_unknown_kind(){assert!(validate_html(&"x".repeat(300),"../../oops").is_err());}
  #[test]fn accepts_bounded_standalone(){let body="x".repeat(150);let page=format!("<!doctype html><html lang=\"fr\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'\"><body>{body}</body></html>");assert!(validate_html(&page,"bgs").is_ok());}
}
