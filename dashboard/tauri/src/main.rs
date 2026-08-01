#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::env;
use tauri::{WebviewUrl, WebviewWindowBuilder};

/**
 * 仅在系统明确支持常规桌面置顶时启用默认置顶。
 *
 * GNOME Wayland 不向普通应用暴露可靠的全局置顶层；由页面禁用该能力，避免展示与实际不符的状态。
 */
fn always_on_top_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        env::var_os("WAYLAND_DISPLAY").is_none()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

/**
 * 从启动方传入的随机 loopback URL 读取 Dashboard 页面地址。
 */
fn dashboard_url() -> Result<tauri::Url, String> {
    let source = env::var("AGENT_FORUM_DASHBOARD_URL")
        .map_err(|_| "缺少 AGENT_FORUM_DASHBOARD_URL".to_owned())?;
    let url = source
        .parse::<tauri::Url>()
        .map_err(|_| "AGENT_FORUM_DASHBOARD_URL 不是有效 URL".to_owned())?;
    if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") || url.port().is_none() {
        return Err("AGENT_FORUM_DASHBOARD_URL 必须是 127.0.0.1 HTTP 地址".to_owned());
    }
    Ok(url)
}

/**
 * 只允许窗口在启动时确定的本机 host 与端口内导航，防止帖子中的链接获得窗口控制权限。
 */
fn allowed_navigation(expected: tauri::Url, candidate: &tauri::Url) -> bool {
    candidate.scheme() == "http"
        && candidate.host_str() == Some("127.0.0.1")
        && candidate.port() == expected.port()
}

fn main() {
    let url = match dashboard_url() {
        Ok(url) => url,
        Err(message) => {
            eprintln!("Agent Forum Dashboard: {message}");
            std::process::exit(2);
        }
    };
    let navigation_url = url.clone();
    let top_supported = always_on_top_supported();

    tauri::Builder::default()
        .setup(move |app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Agent Forum Dashboard")
                .decorations(false)
                .resizable(false)
                .inner_size(670.0, 124.0)
                .min_inner_size(620.0, 62.0)
                .always_on_top(top_supported)
                .visible(false)
                .on_navigation(move |candidate| allowed_navigation(navigation_url.clone(), candidate));
            // Windows 的默认无边框阴影会额外占用一圈黑色非客户区，遮住页面圆角。
            // Linux 也使用透明外层；macOS 保留系统阴影与圆角，避免依赖私有透明 API。
            #[cfg(target_os = "macos")]
            let window = window.shadow(true);
            #[cfg(not(target_os = "macos"))]
            let window = window.transparent(true).shadow(false);
            let window = window.build()?;
            window.show()?;
            window.set_focus()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri Dashboard 运行失败");
}
