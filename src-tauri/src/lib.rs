// EDCH-BGS-v1.1
//! EDCH backend.
//!
//! Deliberately small: the UI owns all game logic. The backend tails the Elite Dangerous journal
//! and streams raw lines to the UI (journal), reads the companion files the game rewrites, makes
//! the HTTP requests the webview can't (http), manages the game's option files (options), runs
//! the remote access server (remote), shares wing missions (ntfy), handles updates (update), the
//! window and the game launch (app), and writes the logs (logs).
//!
//! Errors the user can see are returned as codes ("fileNotFound", "network: <detail>"), shown
//! in the user's language by the UI (see docs/TRANSLATING.md).

use std::path::PathBuf;
use std::sync::Arc;

mod app;
mod bgs_db;
mod agent_memory; // EDCH-COG-MEMORY-v1.5.3
mod bgs_backup; // EDCH-BGS-RELIABILITY-v1.4.9
mod bgs_pdf; // EDCH-BGS-PDF-v1.4.3
mod http;
mod journal;
mod logs;
mod ntfy;
mod options;
mod foot_binds; // EDCH-ONFOOT-EDIT-v1.4.4
mod paths;
mod remote;
mod system;
mod update;

/// Up to v0.5.2 the app's data (settings, API keys, language, wishlist) lived under the
/// identifier "be.bknadir.edch". Move it to the new folder before the webview opens it.
fn migrate_data_folder() {
    for var in ["LOCALAPPDATA", "APPDATA"] {
        let Ok(base) = std::env::var(var) else { continue };
        let old = PathBuf::from(&base).join("be.bknadir.edch");
        let new = PathBuf::from(&base).join("EDCompanionHelper");
        if old.is_dir() && !new.exists() {
            let _ = std::fs::rename(&old, &new);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    migrate_data_folder();
    logs::init(system::portable());
    tauri::Builder::default()
        // EDCH runs once: launching it again brings the open window to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app::show_main(app)
        }))
        // Reopens the window where it was: position, size, maximised or full screen.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .on_window_event(app::on_window_event)
        .manage(Arc::new(journal::WatchState::default()))
        .manage(remote::RemoteState::default())
        .invoke_handler(tauri::generate_handler![
            bgs_db::bgs_load,
            agent_memory::agent_memory_add,
            agent_memory::agent_memory_list,
            agent_memory::agent_memory_delete,
            // EDCH-COG-STABILISATION-v1.6.1
            agent_memory::agent_memory_backup,
            agent_memory::agent_memory_backups,
            agent_memory::agent_memory_diagnostic,
            agent_memory::agent_memory_restore,
            bgs_db::bgs_save,
            bgs_db::bgs_visit,
            bgs_db::bgs_health,
            bgs_backup::bgs_save_json,
            bgs_pdf::bgs_save_pdf,
            journal::default_journal_dir,
            journal::scan_history,
            journal::start_journal,
            journal::read_aux_file,
            http::http_fetch,
            system::open_url,
            options::options_dir,
            options::list_option_files,
            options::read_option_file,
            options::export_config,
            options::import_config,
            foot_binds::foot_save_preset,
            system::reveal_path,
            system::installer_language,
            remote::remote_start,
            remote::remote_stop,
            remote::remote_publish,
            remote::remote_qr,
            remote::remote_addresses,
            remote::remote_interfaces,
            remote::remote_tailscale,
            system::is_portable,
            app::game_running,
            app::game_focused,
            app::launch_game,
            app::set_close_behavior,
            app::app_quit,
            app::set_fullscreen,
            remote::open_page_in_browser,
            system::update_mode,
            system::clipboard_write,
            ntfy::ntfy_subscribe,
            ntfy::ntfy_unsubscribe,
            ntfy::ntfy_set_farewell,
            logs::log_write,
            logs::log_set_debug,
            logs::logs_open,
            logs::missing_data_save,
            logs::missing_data_show,
            logs::missing_data_exists,
            logs::missing_data_reported,
            update::update_check,
            update::update_download,
            update::update_install
        ])
        .build(tauri::generate_context!())
        .expect("error while running EDCH")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                ntfy::send_farewell();
                logs::info("app", "EDCH closed");
            }
        });
}
