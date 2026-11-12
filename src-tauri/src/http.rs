// EDCH-BGS-CUSTOM-v1
//! HTTP for the UI: requests to a short list of allowed hosts (Spansh, EDDN, EDSM, Inara, ntfy),
//! made from Rust because the webview can't reach them (CORS). URLs are redacted in the logs.

use serde::Serialize;
use std::time::{Duration, Instant};

use crate::logs;

#[derive(Serialize)]
pub struct HttpReply {
    status: u16,
    body: String,
}

/// Hosts the UI may talk to. Everything else is refused.
const ALLOWED_HOSTS: [&str; 8] = [
    "https://ntfy.sh/",
    "https://tick.edcd.io/",
    "https://spansh.co.uk/",
    "https://www.spansh.co.uk/",
    "https://eddn.edcd.io:4430/",
    "https://www.edsm.net/",
    "https://inara.cz/",
    "https://edsm.net/",
];

/// One HTTP request to an allowed host. Non-2xx answers are returned, not errors,
/// so the caller can apply each service's retry rules (EDDN forbids retrying a 400).
pub fn blocking_http(
    method: &str,
    url: &str,
    body: Option<&str>,
    content_type: Option<&str>,
) -> Result<HttpReply, String> {
    if !ALLOWED_HOSTS.iter().any(|h| url.starts_with(h)) {
        return Err(format!("addressRefused: {url}"));
    }
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(30))
        .redirects(0) // A 3xx to a different host must NOT escape the allow-list.
        .user_agent(concat!("EDCH/", env!("CARGO_PKG_VERSION")))
        .build();
    let request = agent.request(&method.to_uppercase(), url);
    let result = match body {
        Some(text) => request
            .set("Content-Type", content_type.unwrap_or("application/json"))
            .send_string(text),
        None => request.call(),
    };
    match result {
        Ok(response) => {
            let status = response.status();
            let body = response.into_string().map_err(|e| e.to_string())?;
            Ok(HttpReply { status, body })
        }
        Err(ureq::Error::Status(status, response)) => Ok(HttpReply {
            status,
            body: response.into_string().unwrap_or_default(),
        }),
        Err(error) => Err(format!("network: {error}")),
    }
}

/// Generic HTTP for the UI (no CORS from Rust).
#[tauri::command]
pub async fn http_fetch(
    method: String,
    url: String,
    body: Option<String>,
    content_type: Option<String>,
) -> Result<HttpReply, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let result = blocking_http(&method, &url, body.as_deref(), content_type.as_deref());
        let ms = started.elapsed().as_millis();
        match &result {
            Ok(reply) if reply.status < 400 => logs::debug(
                "http",
                &format!("{method} {} → {} ({ms} ms)", logs::redact(&url), reply.status),
            ),
            Ok(reply) => logs::warn(
                "http",
                &format!(
                    "{method} {} → {} ({ms} ms) {}",
                    logs::redact(&url),
                    reply.status,
                    reply.body.chars().take(200).collect::<String>()
                ),
            ),
            Err(e) => logs::warn("http", &format!("{method} {} → {e} ({ms} ms)", logs::redact(&url))),
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
