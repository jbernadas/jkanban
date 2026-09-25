use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const BOARD_FILE: &str = "board.json";

fn board_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(BOARD_FILE))
}

/// Returns the saved board JSON, or `None` if nothing has been saved yet.
#[tauri::command]
fn load_board(app: AppHandle) -> Result<Option<String>, String> {
    let path = board_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

/// Writes the board JSON atomically (temp file + rename) so a crash
/// mid-write can't leave a truncated board behind.
#[tauri::command]
fn save_board(app: AppHandle, data: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&data).map_err(|e| format!("invalid JSON: {e}"))?;
    let path = board_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_board, save_board])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
