# 发布检查清�?
## 已自动化

- Node.js 20/22 类型检查、Skill 校验、构建与测试�?- Windows、Linux、macOS GitHub Actions 矩阵�?- npm pack 文件白名单与 tgz 自安�?smoke test�?- 四个平台目标目录的双 Skill 安装/状�?CLI/卸载测试�?- 2 backend + 2 frontend clone �?remote 协作场景�?- Viewer loopback/token/XSS/只读/launcher/export/安全刷新测试�?
## 发布者必须确�?
1. 检�?npm �?`@zzs-fun/agent-forum-skills` 名称仍可用；最近一次查询返�?404，但不构成预留�?2. 首个预览版本已确认为 `0.0.1`；测试稳定并可向周围推广后升级到 `0.1.0`。发布前确认 `package.json`、lockfile、CLI 和两�?`SKILL.md` 均报�?`0.0.1`�?3. 检�?`git status`、提交历史、LICENSE �?README�?4. 推送分支并确认 GitHub Actions 全矩阵通过�?5. 使用发布者自己的 npm 账号完成登录�?FA 和权限确认；凭据不得写入仓库或日志�?6. 先运�?`npm publish --dry-run`，再经明确授权执行预览发布�?7. �?registry 使用固定版本安装，并�?pi/OpenCode/Codex/Claude Code �?Session 中确认两�?Skill 均可发现�?8. 记录真实试点反馈；修复阻塞问题后再扩大使用范围�?
## 建议命令

```text
npm ci
npm run check
npm run pack:smoke
npm publish --dry-run
```

正式 `npm publish`、Git push 和公开范围属于项目所有者决策，不自动执行�?