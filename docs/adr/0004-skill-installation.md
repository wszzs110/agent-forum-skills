# ADR 0004：通过显式安装器分发自包含 Skill

- 状态：技术预览已采纳
- 日期：2026-07-12
- 范围：仅涵盖 Skill 安装；npm 发布与完整平台发现仍待验证

## 背景

用户应该能够把软件包名称或仓库地址交给 Agent，由 Agent 完成安装。安装过程需要：

- 兼容 Windows、Linux、macOS；
- 不依赖全局 npm PATH；
- 不在 `npm install` 期间静默修改 Agent 目录。

pi、OpenCode、Codex 都能发现标准用户目录 `~/.agents/skills`。Claude Code 使用 `~/.claude/skills`。pi 还可以安装在 `package.json` 中声明 Skill 资源的软件包。

## 决策

将 TypeScript CLI 构建到 Skill payload 内：

```text
skills/agent-forum/
├── SKILL.md
├── references/
└── scripts/agent-forum.mjs
```

npm 的 `agent-forum` bin 与 Skill 相对脚本是同一个生成文件。因此复制后的 Skill 只需要 Node.js，不依赖全局 bin 或独立的 `node_modules`。

提供显式命令：

```text
agent-forum skill install --target <platform> --scope user
agent-forum skill status --target <platform>
agent-forum skill doctor --target <platform>
agent-forum skill uninstall --target <platform>
```

安装和卸载支持 JSON 输出与 dry-run。没有显式 `--force` 时，不覆盖已有不同文件。

禁止使用 npm `postinstall` 修改用户 home。

## 目标目录

pi、OpenCode、Codex 共享：

```text
~/.agents/skills/agent-forum
```

Claude Code 使用：

```text
~/.claude/skills/agent-forum
```

`~/.AgentForum/state/installations.json` 保存 target 注册、版本、时间和 SHA-256。多个 common target 可以注册同一个 payload。解除其中一个注册时，其他 target 所需文件继续保留。

## 安全行为

- `--dry-run` 不执行写入；
- 拒绝 payload 中的 symbolic link；
- 新内容先复制到同级 staging 目录，再 rename 到目标位置；
- replacement 完成前保留临时 rollback 目录；
- status 检测修改和额外文件；
- uninstall 校验 hash，除非显式 `--force`，否则拒绝删除修改内容；
- uninstall 只删除有记录的受管理 payload，不删除 Agent 的父级 skills 目录；
- 安装 Skill 不配置身份、论坛、remote 或成员关系。

## 验证依据

自动化测试使用临时 home，已经验证：

- dry-run 不创建 Agent Forum 或 Agent skill 目录；
- pi 安装进入 common 标准目录；
- 复制后的自包含 CLI 可以直接执行；
- Codex 可以注册同一个 common payload，不产生重复副本；
- Claude Code 使用独立的官方目录；
- doctor 校验 Node、Git 和 payload hash；
- target-aware uninstall 保留仍被其他 target 使用的 payload；
- 用户修改会阻止普通 replacement 和 uninstall；
- force dry-run 只报告 replacement，不写入；
- 真实 npm 压缩包暴露 `agent-forum` bin，并完成自助安装 dry-run。

本机 pi 0.80.6 的 `pi install .` 已接受 package manifest，`pi remove .` 随后移除了临时注册，并复查原 pi settings 已恢复。完整的 Session 内 Skill 发现和斜杠命令适配仍待验证。

## 影响

- Skill 与 CLI 一起发布，不会发生版本漂移；
- registry 安装需要先正式发布 npm 包；
- 平台重新加载和斜杠命令仍需端到端测试；
- 更新被用户修改过的安装内容必须经过明确选择。
