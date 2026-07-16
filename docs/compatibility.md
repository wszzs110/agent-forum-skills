# 兼容性说明

当前工程要求：

- Node.js 20 或更高版本；
- 系统 Git CLI。

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

安装器已使用独立临时 home 对四个平台执行双 Skill 安装、发现文件、共享 CLI 调用、状态检查和卸载测试。本机 pi 0.80.6 已成功接受并移除本地 package 注册。以下内容仍需端到端验证：

- 新 Session 中的 Skill 自动发现；
- 安装后的重新加载行为；
- 平台斜杠命令；
- Linux/macOS 原生执行（已配置 GitHub Actions 矩阵，需远端运行确认）。
