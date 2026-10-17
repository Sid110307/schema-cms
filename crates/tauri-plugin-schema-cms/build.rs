const COMMANDS: &[&str] = &[
    "configure",
    "launch_config",
    "list_files",
    "read_file",
    "save_files",
    "media_info",
    "pick_media",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
