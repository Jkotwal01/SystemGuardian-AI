use std::{
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};

// Global handle so we can kill the backend on shutdown
static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Find the project root by walking up from the executable or from __FILE__
/// at compile time. During dev the exe lives in src-tauri/target/…, so we
/// walk up until we find `backend/`.
fn find_project_root() -> Option<PathBuf> {
    // In dev, __DIR__ is the src-tauri/src directory.
    // We walk upward from the manifest directory baked in at compile time.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")); // …/apps/desktop/src-tauri
                                                                  // Go up three levels: src-tauri → desktop → apps → project root
    manifest_dir
        .parent() // apps/desktop
        .and_then(|p| p.parent()) // apps
        .and_then(|p| p.parent()) // project root
        .map(|p| p.to_path_buf())
}

/// Spawn `uvicorn app.main:app --host 127.0.0.1 --port 8765` using the
/// virtual-env Python in `<root>/backend/.venv`.
fn spawn_backend(root: &Path) -> std::io::Result<Child> {
        let backend_dir = root.join("backend");

    // Prefer the venv uvicorn; fall back to system uvicorn
    #[cfg(target_os = "windows")]
    let uvicorn = {
        let venv = backend_dir
            .join(".venv")
            .join("Scripts")
            .join("uvicorn.exe");
        if venv.exists() {
            venv
        } else {
            PathBuf::from("uvicorn")
        }
    };
    #[cfg(not(target_os = "windows"))]
    let uvicorn = {
        let venv = backend_dir.join(".venv").join("bin").join("uvicorn");
        if venv.exists() {
            venv
        } else {
            PathBuf::from("uvicorn")
        }
    };

    Command::new(uvicorn)
        .args([
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8765",
            "--log-level",
            "warning",
        ])
        .current_dir(&backend_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
}

/// Block until the backend's /health endpoint responds (max ~15 s).
fn wait_for_backend(max_attempts: u32) {
    for _ in 0..max_attempts {
        if TcpStream::connect("127.0.0.1:8765").is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(500));
    }
}

// ── Window commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// ── Entry point ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_window
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ── Spawn FastAPI backend ──────────────────────────────────────
            // Skip if someone already has port 8765 bound (manual dev start, hot-reload, etc.)
            let already_running = TcpStream::connect("127.0.0.1:8765").is_ok();
            if already_running {
                log::info!("Backend already listening on port 8765 — skipping auto-spawn.");
            } else if let Some(root) = find_project_root() {
                match spawn_backend(&root) {
                    Ok(child) => {
                        log::info!("Backend process spawned (pid {})", child.id());
                        *BACKEND_PROCESS.lock().unwrap() = Some(child);
                        // Wait up to 15 s for the backend to be ready
                        thread::spawn(|| wait_for_backend(30));
                    }
                    Err(e) => {
                        log::warn!("Could not spawn backend: {e}. Assuming it is already running.");
                    }
                }
            } else {
                log::warn!("Could not locate project root — backend not auto-started.");
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the backend when the last window closes
                if let Ok(mut guard) = BACKEND_PROCESS.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        log::info!("Backend process terminated.");
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
