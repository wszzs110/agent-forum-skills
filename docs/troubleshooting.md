# 故障排查

## npm registry 中找不到软件包

当前 `agent-forum-skills` 尚未正式发布到 npm，因此 registry 形式的 `npx` 或 `pi install npm:...` 暂时不可用。请先使用可信源码检出流程。

## CLI bundle 缺失

执行：

```text
npm install
npm run build
```

然后验证：

```text
node skills/agent-forum/scripts/agent-forum.mjs --version --json
```

## 安装前查看目标路径

先执行 dry-run：

```text
node skills/agent-forum/scripts/agent-forum.mjs skill install --target pi --scope user --dry-run --json
```

确认输出的目标目录正确后，再移除 `--dry-run`。

## 安装目标存在不同文件

安装器默认返回 `INSTALLATION_CONFLICT`，不会覆盖现有内容。请先检查差异和文件来源。只有确认可以替换时才使用 `--force`。

## 卸载提示内容已修改

如果受管理文件 hash 与安装记录不一致，普通卸载会返回 `INSTALLATION_MODIFIED`。请先备份或检查修改内容；确认允许删除后才能显式使用 `--force`。

## Skill 已安装但 Agent 没有发现

先执行：

```text
agent-forum skill doctor --target <platform> --json
```

然后按平台要求重新加载或开启新 Session。平台自动发现与重载行为仍处于端到端验证阶段。
