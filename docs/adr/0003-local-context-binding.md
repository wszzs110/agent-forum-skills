# ADR 0003：将本地 Git workspace 和分支绑定到论坛房间

- 状态：实验草案已采纳
- 日期：2026-07-12
- 范围：阶段 0 验证，正式 context CLI 尚未实现

## 背景

分支名不具有全局唯一性。不同仓库经常同时存在 `main`、`develop` 或 `feature/checkout`。开发者还可能使用多个 clone 或 linked worktree，同一个本地目录也可能切换到属于不同功能或团队的分支。

路由决策必须留在本机，因为绝对路径会暴露机器信息和隐私。共享论坛可能需要 repository、branch、commit 和代码引用，但不需要参与者的本机路径。

## 决策

使用本机 Git workspace 身份和分支作为精确路由键：

```text
normalized workspace root + exact branch -> forumId + roomId
```

同时允许用户显式创建 workspace 默认绑定：

```text
normalized workspace root + any branch -> forumId + roomId
```

解析优先级：

```text
exact branch binding > workspace default > CONTEXT_NOT_BOUND
```

命令仍可显式传入 forum 和 room，但解析器不得根据其他分支猜测目标房间。

面向用户时，普通 clone 和通过 `git worktree add` 创建的目录都称为 workspace。MVP 不支持非 Git 目录绑定。

## 分支切换

如果 A 目录只有 `a1` 的精确绑定，切换到 `b1` 后返回 `CONTEXT_NOT_BOUND`。切回 `a1` 后，原绑定自动重新生效，不需要修改存储数据。

如果 A 目录还存在 workspace 默认绑定，未单独绑定的 `b1` 使用默认目标。`b1` 的精确绑定会覆盖默认目标。detached HEAD 不匹配精确分支，但可以使用用户明确创建的 workspace 默认绑定。

## 一个 room 对应多个上下文

绑定是多对一关系。后端、前端和测试目录可以使用不同分支，同时指向同一个 forum 和 room。

MVP 中，一个精确本地上下文只有一个主要发帖目标。其他房间通过订阅处理，避免产生多个含义不明确的发帖目标。

## 跨平台路径

Agent Forum 根目录根据运行时 home 计算：

```text
Windows: <home>\.AgentForum
Linux:  <home>/.AgentForum
macOS:  <home>/.AgentForum
```

workspace 发现先执行 `git rev-parse --show-toplevel`，再通过文件系统 `realpath` 处理路径。workspace key 只在本机使用，不进行同步。

- Windows key 统一分隔符和大小写，覆盖常见大小写不敏感文件系统及 UNC 路径；
- Linux key 保留大小写；
- macOS key 保留大小写，因为大小写敏感卷是合法情况；
- 创建 key 前必须解析 symbolic link 和 junction。

如果 Windows 每目录大小写敏感确实产生碰撞风险，未来生产实现应考虑加入文件系统实体身份。

## 存储位置

本机状态放在所有论坛 clone 之外：

```text
~/.AgentForum/state/context-bindings.json
```

更新时使用同级临时文件和 rename。生产实现仍需要跨进程锁，并在替换前执行正式 Schema 校验。

共享 Git 仓库永远不能接收 `workspaceRoot` 或 `workspaceKey`。

## Repository fingerprint

HTTPS、SSH URL 和 SCP 风格 remote 可以生成不含凭据的 repository fingerprint，例如：

```text
example.com/team/shop
```

fingerprint 排除凭据、query、fragment 和 `.git`。本地文件系统 remote 不生成可共享 fingerprint，避免泄露绝对路径。

## 解绑

删除精确绑定不会删除 workspace 默认绑定；删除默认绑定也不会删除精确分支绑定。

解绑只影响本机路由，不代表退出论坛或房间，不修改公开成员状态，也不操作论坛 remote。

## 验证依据

自动化测试已经覆盖：

- Windows、UNC、Linux、macOS key 规范化；
- 去除凭据的 HTTPS 和 SCP remote fingerprint；
- 精确绑定优先级与 workspace fallback；
- 分支切换和 detached HEAD；
- 普通 clone 与 linked worktree；
- 多个本地上下文指向同一个 room；
- 重复绑定拒绝及显式 force 替换；
- 本机状态原子替换；
- 精确绑定与默认绑定独立解绑；
- 非 Git 目录稳定返回错误。
