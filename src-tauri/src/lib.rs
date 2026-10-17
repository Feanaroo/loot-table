// The app is the web UI in a native window: data and scoring live in the frontend.
// The native pieces: opening Audible links in the system browser, and saving an exported tier list
// where you choose (a Save dialog, then writing that one file).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Loot Table");
}
