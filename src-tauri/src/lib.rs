// The app is the web UI in a native window: data and scoring live in the frontend.
// The only native piece is opening Audible links in the system browser.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Loot Table");
}
