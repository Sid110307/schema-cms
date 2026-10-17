use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};
use tauri_plugin_dialog::DialogExt;
use tempfile::{Builder as TempBuilder, TempPath};

const CONFIG_FILE: &str = "schema-cms.config.json";
const MEDIA_EXTS: &[&str] = &["webp", "png", "jpg", "jpeg", "gif", "svg", "avif", "mp4", "mov", "m4v", "webm"];

type CmdResult<T> = Result<T, String>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPaths {
    data_dir: PathBuf,
    entry_glob: String,
    images_dir: PathBuf,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathsInput {
    data_dir: Option<String>,
    entry_glob: Option<String>,
    images_dir: Option<String>,
}

#[derive(Default)]
struct Ctx {
    paths: Mutex<Option<ResolvedPaths>>,
}

impl Ctx {
    fn get(&self) -> CmdResult<ResolvedPaths> {
        self.paths
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
            .ok_or_else(|| "schema-cms is not configured yet".into())
    }
}

fn absolute(p: impl AsRef<Path>) -> PathBuf {
    let p = p.as_ref();
    let abs = std::path::absolute(p).unwrap_or_else(|_| p.to_path_buf());
    dunce::canonicalize(&abs).unwrap_or(abs)
}

fn non_empty(v: Option<String>) -> Option<String> {
    v.filter(|s| !s.trim().is_empty())
}

fn inside(base: &Path, path: &Path) -> CmdResult<PathBuf> {
    let p = dunce::canonicalize(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if p.starts_with(base) {
        Ok(p)
    } else {
        Err(format!("{} is outside the data folder", path.display()))
    }
}

#[tauri::command]
fn configure<R: Runtime>(app: AppHandle<R>, ctx: State<'_, Ctx>, paths: PathsInput) -> CmdResult<ResolvedPaths> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let data_dir = absolute(non_empty(paths.data_dir).map(PathBuf::from).unwrap_or_else(|| cwd.clone()));
    if !data_dir.is_dir() {
        return Err(format!("Data folder not found: {}", data_dir.display()));
    }
    let images_dir = absolute(non_empty(paths.images_dir).map(PathBuf::from).unwrap_or_else(|| cwd.join("public").join("images")));
    let entry_glob = non_empty(paths.entry_glob).unwrap_or_else(|| "*.js".into());

    let _ = app.asset_protocol_scope().allow_directory(&images_dir, true);

    let resolved = ResolvedPaths { data_dir, entry_glob, images_dir };
    *ctx.paths.lock().map_err(|e| e.to_string())? = Some(resolved.clone());
    Ok(resolved)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchConfig {
    config: Option<serde_json::Value>,
    config_dir: PathBuf,
    env: BTreeMap<String, String>,
}

#[tauri::command]
fn launch_config() -> CmdResult<LaunchConfig> {
    let env: BTreeMap<String, String> = std::env::vars().filter(|(k, _)| k.starts_with("SCHEMA_CMS_")).collect();
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;

    let candidate = std::env::args()
        .skip(1)
        .find(|a| a.ends_with(".json"))
        .map(PathBuf::from)
        .or_else(|| env.get("SCHEMA_CMS_CONFIG").map(PathBuf::from))
        .unwrap_or_else(|| cwd.join(CONFIG_FILE));

    if !candidate.is_file() {
        return Ok(LaunchConfig { config: None, config_dir: cwd, env });
    }

    let path = absolute(&candidate);
    let dir = path.parent().map(Path::to_path_buf).unwrap_or(cwd);
    let text = fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut config: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;

    if let Some(obj) = config.as_object_mut() {
        for key in ["dataDir", "imagesDir"] {
            if let Some(serde_json::Value::String(s)) = obj.get(key) {
                let resolved = absolute(dir.join(s));
                obj.insert(key.into(), resolved.to_string_lossy().into_owned().into());
            }
        }
    }

    Ok(LaunchConfig { config: Some(config), config_dir: dir, env })
}

#[tauri::command]
fn list_files(ctx: State<'_, Ctx>) -> CmdResult<Vec<String>> {
    let paths = ctx.get()?;
    let pattern = format!(
        "{}/{}",
        glob::Pattern::escape(&paths.data_dir.to_string_lossy()),
        paths.entry_glob.trim_start_matches(['/', '\\'])
    );
    let mut files: Vec<String> = glob::glob(&pattern)
        .map_err(|e| format!("Invalid entry glob: {e}"))?
        .filter_map(Result::ok)
        .filter(|p| p.is_file())
        .map(|p| dunce::simplified(&p).to_string_lossy().into_owned())
        .collect();
    files.sort();
    Ok(files)
}

#[tauri::command]
fn read_file(ctx: State<'_, Ctx>, path: String) -> CmdResult<String> {
    let paths = ctx.get()?;
    let p = inside(&paths.data_dir, Path::new(&path))?;
    fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {e}", p.display()))
}

#[derive(Deserialize)]
struct FileWrite {
    path: String,
    text: String,
}

struct Prepared {
    target: PathBuf,
    staged: TempPath,
    backup: TempPath,
}

fn temp_beside(target: &Path) -> std::io::Result<tempfile::NamedTempFile> {
    let name = target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    TempBuilder::new()
        .prefix(&format!(".{name}."))
        .suffix(".tmp")
        .tempfile_in(target.parent().unwrap_or(Path::new(".")))
}

fn prepare(target: PathBuf, text: &str) -> std::io::Result<Prepared> {
    let mut staged = temp_beside(&target)?;
    staged.write_all(text.as_bytes())?;
    staged.as_file().sync_all()?;
    let perms = fs::metadata(&target)?.permissions();
    let staged = staged.into_temp_path();
    fs::set_permissions(&staged, perms)?;

    let backup = temp_beside(&target)?.into_temp_path();
    fs::copy(&target, &backup)?;
    Ok(Prepared { target, staged, backup })
}

#[tauri::command]
fn save_files(ctx: State<'_, Ctx>, files: Vec<FileWrite>) -> CmdResult<()> {
    let paths = ctx.get()?;
    let mut prepared = Vec::with_capacity(files.len());
    for f in &files {
        let target = inside(&paths.data_dir, Path::new(&f.path))?;
        prepared.push(prepare(target.clone(), &f.text).map_err(|e| format!("Failed to prepare {}: {e}", target.display()))?);
    }

    let mut replaced: Vec<(PathBuf, TempPath)> = Vec::new();
    let mut failure = None;
    for p in prepared {
        match p.staged.persist(&p.target) {
            Ok(()) => replaced.push((p.target, p.backup)),
            Err(e) => {
                failure = Some(format!("Failed to write {}: {}", p.target.display(), e.error));
                break;
            }
        }
    }

    let Some(failure) = failure else { return Ok(()) };

    let mut kept = Vec::new();
    for (target, backup) in replaced.into_iter().rev() {
        if let Err(e) = backup.persist(&target) {
            if let Ok(path) = e.path.keep() {
                kept.push(path.display().to_string());
            }
        }
    }
    if kept.is_empty() {
        Err(failure)
    } else {
        Err(format!("{failure}; rollback failed, backups remain at: {}", kept.join(", ")))
    }
}

#[derive(Serialize)]
struct MediaInfo {
    path: String,
    exists: bool,
}

#[tauri::command]
fn media_info(ctx: State<'_, Ctx>, rel: String) -> CmdResult<MediaInfo> {
    let paths = ctx.get()?;
    let joined = paths.images_dir.join(rel.trim_start_matches(['/', '\\']));
    let resolved = dunce::canonicalize(&joined).unwrap_or(joined);
    Ok(MediaInfo {
        exists: resolved.is_file(),
        path: resolved.to_string_lossy().into_owned(),
    })
}

#[derive(Serialize)]
struct Picked {
    rel: Vec<String>,
    rejected: Vec<String>,
}

#[tauri::command]
async fn pick_media<R: Runtime>(app: AppHandle<R>, ctx: State<'_, Ctx>, multiple: bool) -> CmdResult<Option<Picked>> {
    let paths = ctx.get()?;
    let dialog = app
        .dialog()
        .file()
        .set_title(if multiple { "Add media" } else { "Choose media" })
        .add_filter("Media", MEDIA_EXTS);
    let dialog = if paths.images_dir.is_dir() { dialog.set_directory(&paths.images_dir) } else { dialog };

    let picked = if multiple {
        dialog.blocking_pick_files()
    } else {
        dialog.blocking_pick_file().map(|f| vec![f])
    };
    let Some(picked) = picked else { return Ok(None) };

    let base = absolute(&paths.images_dir);
    let mut out = Picked { rel: vec![], rejected: vec![] };
    for file in picked {
        let Ok(p) = file.into_path() else { continue };
        let p = absolute(&p);
        match p.strip_prefix(&base) {
            Ok(rel) => out.rel.push(rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")),
            Err(_) => out.rejected.push(p.display().to_string()),
        }
    }
    Ok(Some(out))
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("schema-cms")
        .invoke_handler(tauri::generate_handler![
            configure,
            launch_config,
            list_files,
            read_file,
            save_files,
            media_info,
            pick_media
        ])
        .setup(|app, _| {
            app.manage(Ctx::default());
            Ok(())
        })
        .build()
}
