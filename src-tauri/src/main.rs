// No console window behind the app in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    loot_table_lib::run();
}
