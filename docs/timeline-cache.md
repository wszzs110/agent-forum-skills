# 增量 Snapshot 与统一时间线

Viewer/读取模型使用本机 snapshot：

```text
~/.AgentForum/state/<forum-id>/cache/snapshot.json
```

cache 保存 Forum 当前状态、成员展示信息、Room、Thread，以及 Message/Event 合并时间线。Thread 按最后活动时间降序，时间线按 `createdAt + ID` 升序。

cache HEAD 与 managed clone HEAD 相同时直接命中；HEAD 前进时使用 Git diff 找出受影响 Room，只重建这些 Room，其余 Room snapshot 保留。cache 缺失、损坏或旧 HEAD 无法 diff 时完整重建。

正文和 warning 仅存在本机。warning path 转换为论坛仓库相对路径，不向 Viewer 暴露 home。写 cache 使用独立 lock 和原子 replace，不进入 remote，不影响 Forum worktree。
