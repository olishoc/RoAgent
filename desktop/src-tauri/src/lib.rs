use serde::Serialize;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const DAEMON_HOST: &str = "127.0.0.1";
const DAEMON_PORT: u16 = 45678;
const DAEMON_EXE: &str = "studiolink-daemon.exe";
const BRIDGE_PLUGIN_FILE_NAME: &str = "StudioLinkPlugin_Bundled.lua";
const BRIDGE_PLUGIN_BUNDLE: &str = include_str!("../../../plugin/StudioLinkBridgeOnly_Bundled.lua");
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStatus {
    platform: String,
    install_dir: String,
    data_dir: String,
    daemon_path: String,
    command_shim_path: String,
    roblox_plugins_dir: String,
    bridge_plugin_path: String,
    daemon_installed: bool,
    command_shim_installed: bool,
    bridge_plugin_installed: bool,
    daemon_reachable: bool,
    auth_token_available: bool,
    health: Option<Value>,
    installed_status: Option<Value>,
    last_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActionResult {
    success: bool,
    message: String,
    status: AppStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSummary {
    place_id: String,
    place_name: Option<String>,
    game_id: Option<String>,
    job_id: Option<String>,
    place_dir: String,
    repo_dir: String,
    has_repo: bool,
    active: bool,
    scripts_count: usize,
    total_bytes: u64,
    updated_at: Option<String>,
}

#[derive(Debug, Default)]
struct RegistrySummary {
    scripts_count: usize,
    total_bytes: u64,
    updated_at: Option<String>,
    place_name: Option<String>,
    game_id: Option<String>,
    job_id: Option<String>,
}

fn local_app_data_dir() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join("AppData").join("Local")))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn roaming_app_data_dir() -> PathBuf {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join("AppData").join("Roaming")))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn install_dir() -> PathBuf {
    local_app_data_dir().join("Programs").join("StudioLink")
}

fn data_dir() -> PathBuf {
    roaming_app_data_dir().join("StudioLink")
}

fn daemon_path() -> PathBuf {
    install_dir().join(DAEMON_EXE)
}

fn command_shim_path() -> PathBuf {
    install_dir().join("StudioLink.cmd")
}

fn roblox_plugins_dir() -> PathBuf {
    #[cfg(windows)]
    {
        return local_app_data_dir().join("Roblox").join("Plugins");
    }

    #[cfg(not(windows))]
    {
        let home = env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
        return home.join("Documents").join("Roblox").join("Plugins");
    }
}

fn bridge_plugin_path() -> PathBuf {
    roblox_plugins_dir().join(BRIDGE_PLUGIN_FILE_NAME)
}

fn http_request(method: &str, path: &str, token: Option<&str>, body: Option<&str>) -> Result<String, String> {
    let mut stream = TcpStream::connect((DAEMON_HOST, DAEMON_PORT)).map_err(|error| error.to_string())?;
    stream.set_read_timeout(Some(Duration::from_secs(4))).map_err(|error| error.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(4))).map_err(|error| error.to_string())?;

    let body = body.unwrap_or("");
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {DAEMON_HOST}:{DAEMON_PORT}\r\nConnection: close\r\nAccept: application/json\r\nContent-Length: {}\r\n",
        body.as_bytes().len()
    );
    if let Some(token) = token {
        request.push_str(&format!("x-roagent-token: {token}\r\n"));
    }
    if !body.is_empty() {
        request.push_str("Content-Type: application/json\r\n");
    }
    request.push_str("\r\n");
    request.push_str(body);

    stream.write_all(request.as_bytes()).map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|error| error.to_string())?;
    let (_, payload) = response.split_once("\r\n\r\n").ok_or("Daemon returned an invalid HTTP response")?;
    Ok(payload.to_string())
}

fn daemon_json(method: &str, path: &str, token: Option<&str>, body: Option<&str>) -> Result<Value, String> {
    let payload = http_request(method, path, token, body)?;
    serde_json::from_str(&payload).map_err(|error| error.to_string())
}

fn auth_token() -> Result<String, String> {
    let value = daemon_json("GET", "/auth-token", None, None)?;
    value
        .get("token")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or("Daemon did not return an auth token".to_string())
}

fn daemon_post(path: &str, body: &str) -> Result<Value, String> {
    let token = auth_token()?;
    daemon_json("POST", path, Some(&token), Some(body))
}

#[tauri::command]
fn daemon_rpc(message_type: String, place_id: String, payload: Value) -> Result<Value, String> {
    let request_id = format!("desktop-{}", chrono_like_request_id());
    let envelope = json!({
        "version": "1",
        "type": message_type,
        "requestId": request_id,
        "placeId": if place_id.trim().is_empty() { "__global__" } else { place_id.as_str() },
        "payload": if payload.is_object() { payload } else { json!({}) },
    });
    let token = auth_token()?;
    daemon_json("POST", "/rpc", Some(&token), Some(&envelope.to_string()))
}

fn chrono_like_request_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("{millis}-{}", std::process::id())
}

fn installed_status_json() -> Option<Value> {
    let path = daemon_path();
    if !path.exists() {
        return None;
    }
    let mut command = Command::new(path);
    command.arg("status");
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    serde_json::from_slice(&output.stdout).ok()
}

fn current_status(last_error: Option<String>) -> AppStatus {
    let daemon = daemon_path();
    let shim = command_shim_path();
    let bridge_plugin = bridge_plugin_path();
    let health = daemon_json("GET", "/health", None, None).ok();
    let token_available = health.is_some() && auth_token().is_ok();

    AppStatus {
        platform: format!("{}-{}", env::consts::OS, env::consts::ARCH),
        install_dir: install_dir().to_string_lossy().to_string(),
        data_dir: data_dir().to_string_lossy().to_string(),
        daemon_path: daemon.to_string_lossy().to_string(),
        command_shim_path: shim.to_string_lossy().to_string(),
        roblox_plugins_dir: roblox_plugins_dir().to_string_lossy().to_string(),
        bridge_plugin_path: bridge_plugin.to_string_lossy().to_string(),
        daemon_installed: daemon.exists(),
        command_shim_installed: shim.exists(),
        bridge_plugin_installed: bridge_plugin.exists(),
        daemon_reachable: health.is_some(),
        auth_token_available: token_available,
        health,
        installed_status: installed_status_json(),
        last_error,
    }
}

#[tauri::command]
fn app_status() -> AppStatus {
    current_status(None)
}

#[tauri::command]
fn list_projects() -> Vec<ProjectSummary> {
    let places_dir = data_dir().join("places");
    let mut projects = Vec::new();
    let entries = match fs::read_dir(&places_dir) {
        Ok(entries) => entries,
        Err(_) => return projects,
    };

    for entry in entries.flatten() {
        let place_dir = entry.path();
        if !place_dir.is_dir() {
            continue;
        }
        let place_id = entry.file_name().to_string_lossy().to_string();
        let repo_dir = data_dir().join("repos").join(&place_id);
        let registry = place_dir.join("scripts.json");
        let summary = summarize_scripts_registry(&registry);
        projects.push(ProjectSummary {
            place_id,
            place_name: summary.place_name,
            game_id: summary.game_id,
            job_id: summary.job_id,
            place_dir: place_dir.to_string_lossy().to_string(),
            repo_dir: repo_dir.to_string_lossy().to_string(),
            has_repo: repo_dir.exists(),
            active: false,
            scripts_count: summary.scripts_count,
            total_bytes: summary.total_bytes,
            updated_at: summary.updated_at,
        });
    }

    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then_with(|| a.place_id.cmp(&b.place_id)));
    projects
}

fn summarize_scripts_registry(path: &Path) -> RegistrySummary {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(_) => return RegistrySummary::default(),
    };
    let parsed: Value = match serde_json::from_str(&text) {
        Ok(parsed) => parsed,
        Err(_) => return RegistrySummary::default(),
    };
    let scripts = parsed.get("scripts").and_then(Value::as_array);
    let scripts_count = scripts.map_or(0, |items| items.iter().filter(|script| script.get("deleted").and_then(Value::as_bool) != Some(true)).count());
    let total_bytes = scripts
        .map(|items| {
            items
                .iter()
                .filter(|script| script.get("deleted").and_then(Value::as_bool) != Some(true))
                .filter_map(|script| script.get("size").and_then(Value::as_u64))
                .sum()
        })
        .unwrap_or(0);
    let updated_at = parsed.get("updatedAt").and_then(Value::as_str).map(str::to_owned);
    let metadata = parsed.get("metadata").and_then(Value::as_object);
    RegistrySummary {
        scripts_count,
        total_bytes,
        updated_at,
        place_name: metadata.and_then(|meta| meta.get("placeName")).and_then(Value::as_str).map(str::to_owned),
        game_id: metadata.and_then(|meta| meta.get("gameId")).and_then(Value::as_str).map(str::to_owned),
        job_id: metadata.and_then(|meta| meta.get("jobId")).and_then(Value::as_str).map(str::to_owned),
    }
}

fn run_installed_daemon(args: &[&str]) -> Result<(), String> {
    let path = daemon_path();
    if !path.exists() {
        return Err(format!("Installed daemon not found at {}", path.display()));
    }
    let mut command = Command::new(path);
    command.args(args);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn start_daemon() -> ActionResult {
    let result = run_installed_daemon(&["start"]);
    std::thread::sleep(Duration::from_millis(900));
    match result {
        Ok(()) => ActionResult { success: true, message: "Daemon start requested.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn stop_daemon() -> ActionResult {
    let result = run_installed_daemon(&["stop"]);
    std::thread::sleep(Duration::from_millis(600));
    match result {
        Ok(()) => ActionResult { success: true, message: "Daemon stop requested.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn restart_daemon() -> ActionResult {
    let result = if auth_token().is_ok() {
        daemon_post("/daemon/restart", "{}").map(|_| ())
    } else {
        run_installed_daemon(&["restart"])
    };
    std::thread::sleep(Duration::from_millis(1200));
    match result {
        Ok(()) => ActionResult { success: true, message: "Daemon restart requested.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn set_autostart(enabled: bool) -> ActionResult {
    let result = daemon_post("/daemon/autostart/set", &format!("{{\"enabled\":{enabled}}}"));
    match result {
        Ok(_) => ActionResult { success: true, message: if enabled { "Autostart enabled.".to_string() } else { "Autostart disabled.".to_string() }, status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn check_updates() -> ActionResult {
    match daemon_post("/daemon/update/check", "{}") {
        Ok(_) => ActionResult { success: true, message: "Update check completed.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn save_ai_config(provider: String, api_key: String, model: String, ai_max_tokens: Option<u32>) -> ActionResult {
    let body = json!({
        "provider": provider,
        "apiKey": api_key,
        "model": model,
        "aiMaxTokens": ai_max_tokens.unwrap_or(8000),
    });
    let result = daemon_post("/config/api-key", &body.to_string());
    match result {
        Ok(_) => ActionResult { success: true, message: "AI provider configuration saved.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn repair_daemon() -> ActionResult {
    match daemon_post("/daemon/repair", "{}") {
        Ok(_) => ActionResult { success: true, message: "Repair check completed.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn open_downloads() -> ActionResult {
    let result = open_url("https://rblxagent.com/download");
    match result {
        Ok(()) => ActionResult { success: true, message: "Opened the RblxAgent download page.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn install_bridge_plugin() -> ActionResult {
    let path = bridge_plugin_path();
    let result = fs::create_dir_all(roblox_plugins_dir())
        .and_then(|_| fs::write(&path, BRIDGE_PLUGIN_BUNDLE))
        .map_err(|error| error.to_string());
    match result {
        Ok(()) => ActionResult {
            success: true,
            message: format!("Installed bridge-only Roblox plugin to {}.", path.display()),
            status: current_status(None),
        },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn reveal_plugin_folder() -> ActionResult {
    let result = fs::create_dir_all(roblox_plugins_dir())
        .map_err(|error| error.to_string())
        .and_then(|_| open_path(&roblox_plugins_dir()));
    match result {
        Ok(()) => ActionResult { success: true, message: "Opened the Roblox local plugins folder.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

#[tauri::command]
fn reveal_project(place_id: String, target: String) -> ActionResult {
    let result = project_folder(&place_id, &target).and_then(|path| {
        if !path.exists() {
            return Err(format!("Project {} folder is not available at {}.", target, path.display()));
        }
        open_path(&path)
    });
    match result {
        Ok(()) => ActionResult { success: true, message: format!("Opened {} folder for project {}.", target, place_id), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

fn project_folder(place_id: &str, target: &str) -> Result<PathBuf, String> {
    let trimmed = place_id.trim();
    if trimmed.is_empty() || trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Invalid Roblox place id.".to_string());
    }
    match target {
        "place" => Ok(data_dir().join("places").join(trimmed)),
        "repo" => Ok(data_dir().join("repos").join(trimmed)),
        _ => Err("Unknown project folder target.".to_string()),
    }
}

fn open_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut command = Command::new("rundll32.exe");
        command.args(["url.dll,FileProtocolHandler", url]).creation_flags(CREATE_NO_WINDOW);
        command.spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(url).spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(url).spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
fn reveal_logs() -> ActionResult {
    let logs = data_dir().join("logs");
    let result = fs::create_dir_all(&logs)
        .map_err(|error| error.to_string())
        .and_then(|_| open_path(&logs));
    match result {
        Ok(()) => ActionResult { success: true, message: "Opened the daemon log folder.".to_string(), status: current_status(None) },
        Err(error) => ActionResult { success: false, message: error.clone(), status: current_status(Some(error)) },
    }
}

fn open_path(path: &PathBuf) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut command = Command::new("explorer.exe");
        command.arg(path).creation_flags(CREATE_NO_WINDOW);
        command.spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(path).spawn().map_err(|error| error.to_string())?;
        return Ok(());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_status,
            list_projects,
            daemon_rpc,
            start_daemon,
            stop_daemon,
            restart_daemon,
            set_autostart,
            check_updates,
            save_ai_config,
            repair_daemon,
            open_downloads,
            install_bridge_plugin,
            reveal_plugin_folder,
            reveal_project,
            reveal_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running StudioLink Mission Control");
}
