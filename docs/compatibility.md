# 兼容性说明

当前工程要求：

- Node.js 20 或更高版本；
- 系统 Git CLI；
- Dashboard 安装阶段需要系统 `tar` 解包 GitHub Release archive；最终用户不需要 Deno，也不需要 Rust/Node 之外的运行时。

Agent 平台验证优先级：

1. pi
2. OpenCode
3. Codex
4. Claude Code

该顺序是优先深度验证矩阵，不是封闭支持名单。核心 Skill 遵循 Agent Skills 的目录与 front matter 规范；任何兼容该标准的平台都可通过通用安装器使用自己的小写平台 slug（例如 `kimi-code`），并写入标准 `.agents/skills` 目录。未知平台没有专用 lifecycle/Dashboard bridge 时，仍可完整使用核心协作、Inbox 和 Viewer Skill。

Forum 对远端手工写入采用“根严格、叶子隔离”策略：`.forum/protocol.json`、`.forum/forum.json` 或 Forum ID/数据分支不一致仍会安全阻止同步；损坏的 Message、Event、成员、Room 或 Thread 叶子记录会随 remote 同步并作为 warning 隔离，不能阻断其他合法 Room 的读取、发帖或同步。已知无歧义的旧写法（`schemaVersion: 1`、短写版本、RFC 3339 offset 或缺毫秒时间）只在读取内存中规范化，CLI 不会改写历史，writer 仍严格生成 1.0 UTC 毫秒格式。

纯路径测试已覆盖：

- Windows；
- Linux；
- macOS；
- Windows UNC 路径。

Git workspace 集成测试目前只在 Windows 环境实际运行，仍需通过 Linux/macOS 原生 CI 验证。

安装器已在独立临时 home 中覆盖四个平台目标的三 Skill 安装、发现、CLI 调用、状态检查和卸载。本机 pi 0.80.6 也已验证 package 注册与移除。

四个平台均可通过 `dashboard open/attach/heartbeat/detach` 使用 Dashboard。Pi 目前提供原生 extension、30 秒 heartbeat 和 `session_shutdown` detach；OpenCode、Codex、Claude Code 使用标准 Skill + CLI bridge。lease 只影响 `Active` 等活跃标记，不再关闭可见窗口；宿主没有可信 lifecycle hook 时，该标记约五分钟后过期。Dashboard 始终等待用户手动关闭。

Windows 已完成 Tauri 系统 WebView 的真实窗口、单实例、snapshot IPC、置顶/折叠与关闭验证。Dashboard 使用 Tauri 2 + 系统 WebView（Windows WebView2），不再携带 Chromium/CEF、Deno runtime 或内置 Deno CLI helper，Windows x64 archive 约 1.5 MiB。

Release workflow 会构建并验证 Windows x64、Linux x64/arm64、macOS x64/arm64 archive，拒绝 CEF/Deno/内置 helper 文件，并强制 30 MiB 压缩体积预算。以下内容仍需端到端验证：

- 新 Session 中的 Skill 自动发现；
- 安装后的重新加载行为；
- pi 原生斜杠命令的发布包发现；
- OpenCode/Codex/Claude Code 的无 hook lease 降级体验；
- Linux/macOS Dashboard 置顶、无边框、关闭退出及系统 WebView GUI 执行（CI archive 验证不等于 GUI 实机验证）；
- Ubuntu 26.x 的 WebKitGTK Wayland/X11、缩放、多显示器、置顶和窗口管理器行为；在 Ubuntu 26 runner 或实机可用前只能标为待验，不能预先承诺完整兼容；
- macOS 下载产物在不同 Gatekeeper 策略下的启动行为；当前 workflow 使用 ad-hoc bundle 签名，正式面向广泛用户分发前仍建议 Developer ID 签名与 notarization。
