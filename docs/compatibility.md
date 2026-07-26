# 兼容性说明

当前工程要求：

- Node.js 20 或更高版本；
- 系统 Git CLI；
- Dashboard 安装阶段需要系统 `tar` 解包 GitHub Release archive；最终用户不需要 Deno。

Agent 平台验证优先级：

1. pi
2. OpenCode
3. Codex
4. Claude Code

核心 Skill 遵循 Agent Skills 的目录与 front matter 规范。

纯路径测试已覆盖：

- Windows；
- Linux；
- macOS；
- Windows UNC 路径。

Git workspace 集成测试目前只在 Windows 环境实际运行，仍需通过 Linux/macOS 原生 CI 验证。

安装器已在独立临时 home 中覆盖四个平台目标的三 Skill 安装、发现、CLI 调用、状态检查和卸载。本机 pi 0.80.6 也已验证 package 注册与移除。

四个平台均可通过 `dashboard open/attach/heartbeat/detach` 使用 Dashboard。Pi 目前提供原生 extension、30 秒 heartbeat 和 `session_shutdown` detach；OpenCode、Codex、Claude Code 使用标准 Skill + CLI bridge。宿主没有可信 lifecycle hook 时，lease 约五分钟后过期，因此生命周期体验不与 pi 等同。

Windows 已完成 Deno Desktop CEF 的真实窗口、单实例、snapshot IPC 和关闭验证。Deno 2.9.4 的 Windows WebView backend 会原生崩溃，因此 release 固定使用 CEF。

Release workflow 会构建并验证 Windows x64、Linux x64/arm64、macOS x64/arm64 archive 和内置 helper。macOS bundle 会保留 CEF versioned framework 必需的标准内部 symlink，并在写入 helper 后重新签名。Dashboard 安装器仅接受预检通过、相对且不逃逸 archive 根目录的 symlink；绝对链接、硬链接及通过链接祖先写入的 entry 均会拒绝。Skill managed payload 仍完全拒绝 symlink。以下内容仍需端到端验证：

- 新 Session 中的 Skill 自动发现；
- 安装后的重新加载行为；
- pi 原生斜杠命令的发布包发现；
- OpenCode/Codex/Claude Code 的无 hook lease 降级体验；
- Linux/macOS Dashboard 置顶、无边框、关闭退出及原生 GUI 执行（CI archive/helper 验证不等于 GUI 实机验证）；
- Ubuntu 26.x 的 CEF Wayland/X11、缩放、多显示器、置顶和窗口管理器行为；在 Ubuntu 26 runner 或实机可用前只能标为待验，不能预先承诺完整兼容；
- macOS 下载产物在不同 Gatekeeper 策略下的启动行为；当前 workflow 使用 ad-hoc bundle 签名，正式面向广泛用户分发前仍建议 Developer ID 签名与 notarization。
