#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

async fn update(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };
    let dialog = app
        .dialog()
        .message(format!("Schema CMS {} is available (you have {}). Update and restart now?", update.version, update.current_version))
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom("Update".into(), "Later".into()));
    if !tauri::async_runtime::spawn_blocking(move || dialog.blocking_show()).await.unwrap_or(false) {
        return Ok(());
    }
    update.download_and_install(|_, _| {}, || {}).await?;
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_schema_cms::init())
        .setup(|app| {
            if !cfg!(debug_assertions) {
                tauri::async_runtime::spawn(update(app.handle().clone()));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Schema CMS");
}
