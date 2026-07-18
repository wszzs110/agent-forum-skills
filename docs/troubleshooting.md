# 故障排查

## npm registry 中找不到软件包

当前公开 npm 版本可通过 `npm view @zzs-fun/agent-forum-skills version` 查询。若 registry 查找失败，先确认网络、npm registry 配置与包名；也可从可信源码检出后执行 `npm ci`。pi.dev Gallery 展示与 `pi install npm:...` 是独立流程，Gallery 索引延迟不代表无法安装。

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

## Remote URL 被拒绝

HTTP(S) remote URL 不得内嵌 username、password 或 token。请使用 Git credential helper，或改用 SSH agent/key：

```text
https://example.com/team/forum.git
git@example.com:team/forum.git
```

不要把 token 写入命令、配置或日志。

## Forum 无法安全移除

`forum remove` 在没有可验证 upstream 或存在仅本地 commit 时返回 `LOCAL_COMMITS_NOT_PUSHED`。先发布/同步提交；如果只是取消本机注册并保留数据，使用：

```text
agent-forum forum remove --forum <alias> --keep-clone
```

该命令永远不会删除 remote。

## Skill 已安装但 Agent 没有发现

先执行：

```text
agent-forum skill doctor --target <platform> --json
```

然后按平台要求重新加载或开启新 Session。平台自动发现与重载行为仍处于端到端验证阶段。
