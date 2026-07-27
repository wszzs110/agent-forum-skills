# 发布检查清单

## 已自动化

- Node.js 20/22 类型检查、Skill 校验、构建与测试；
- Windows、Linux、macOS GitHub Actions 矩阵；
- npm pack 文件白名单与 tgz 自安装 smoke test；
- 四个平台目标目录的三 Skill 安装/状态/CLI/卸载测试；
- Dashboard Windows 本地构建、release archive/manifest、双 SHA-256 与安装器契约测试；release workflow 在每个平台生成单平台 manifest 后执行 archive 安装和内置 helper 验证；
- 2 backend + 2 frontend clone 的 remote 协作场景；
- Viewer loopback/token/XSS/只读/launcher/export/安全刷新测试。

## 发布者必须确认

1. 检查 npm 上 `@zzs-fun/agent-forum-skills` 的当前公开版本、发布权限和 dist-tag；名称已发布，不能再以“查询 404”作为可用性判断。
2. 发布前确认目标版本在 `package.json`、lockfile、`dashboard/deno.json`、CLI bundle 和三个 `SKILL.md` 中一致；不得覆盖或重新发布已存在版本。
3. 检查 `git status`、提交历史、LICENSE 和 README。
4. 推送分支和版本 tag，等待 Dashboard release workflow 生成 Windows x64、Linux x64/arm64、macOS x64/arm64 archive 与 `dashboard-manifest.json`，并确认 GitHub Actions 的构建、安装、helper 版本全矩阵通过。
5. 仅当 `dashboard/deno.json` 的 Dashboard version 变更时，在 GitHub Release 中抽查 manifest URL、平台 asset、体积和 SHA-256，并确认该 Dashboard release 已可公开下载后，再发布引用它的 npm 包。纯 CLI/Skill npm 升级不构建、不发布或下载 Desktop asset；但 Dashboard 内置 CLI helper 所依赖的命令、同步、Viewer 或 snapshot 行为发生变化时，必须提高 Dashboard version 并重新发布资产。随后使用发布者自己的 npm 账号完成登录、2FA 和权限确认；凭据不得写入仓库或日志。
6. 先运行 `npm publish --dry-run`，再经明确授权执行预览发布。
7. 从 registry 使用固定版本安装，并在 pi/OpenCode/Codex/Claude Code 新 Session 中确认三个 Skill 均可发现，并在 pi 中确认 Dashboard extension 可加载。
8. 在 Windows 实测 GUI；在可用的 macOS、Ubuntu 26.x GNOME Wayland 实机分别验证 CEF 窗口、置顶不可用提示、折叠、Viewer、polling 与关闭。CI archive/helper 通过不得替代这些 GUI 结论。
9. 记录真实试点反馈；修复阻塞问题后再扩大使用范围。

## 建议命令

```text
npm ci
npm run check
npm run pack:smoke
git push origin main vX.Y.Z
# 等待对应 GitHub Release assets 全部成功
npm publish --dry-run
npm publish
```

正式 `npm publish`、Git push 和公开范围属于项目所有者决策，不自动执行。
