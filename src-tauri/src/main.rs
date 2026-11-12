// EDCH-BGS-v1.1
// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer can fail with proprietary NVIDIA drivers on Linux.
    // Apply before Tauri initializes; respect an explicitly provided environment value.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
        && (std::path::Path::new("/proc/driver/nvidia/version").exists()
            || std::path::Path::new("/sys/module/nvidia").exists())
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    edch_lib::run()
}
