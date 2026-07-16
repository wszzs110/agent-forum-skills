# 本机存储与写锁

## 目录布局

```text
~/.AgentForum/
├── config.json
├── forums/
│   └── <alias>/
└── state/
    ├── context-bindings.json
    ├── installations.json
    ├── locks/
    ├── cache/
    └── viewer/
```

路径通过 `os.homedir()` 和 Node.js `path` API 计算，不手工拼接 `/` 或 `\\`。

本机 alias 只允许小写字母、数字、点、下划线和连字符，禁止 `..`、斜杠和路径逃逸。

## 原子文件写入

原子写入流程：

1. 在目标文件同级创建 `.agent-forum-tmp-<uuid>`；
2. 使用 exclusive create 写入；
3. 执行 file sync；
4. 关闭文件；
5. rename 到最终路径；
6. 失败时删除临时文件。

协议 JSON 必须先通过 writer Schema 校验，再进行任何落盘操作。

不可变文件和目录已经存在时返回 `IMMUTABLE_PATH_EXISTS`，不得覆盖。

## 不可变目录事务

Message 和 Event 包含多个文件时，先在同级临时目录内完成全部写入和校验，再将完整目录 rename 到最终路径。

writer 失败、进程异常或 rename 失败时，最终路径不能暴露半条数据。残留临时目录由 cleanup/doctor 按名称前缀和年龄清理。

## Forum 写锁

锁路径：

```text
~/.AgentForum/state/locks/<forum-id>.lock/
└── owner.json
```

获取锁使用原子 `mkdir`。`owner.json` 保存：

```text
token
pid
hostname
command
startedAt
```

规则：

- 写事务全程持锁；
- 读取不获取该锁；
- 已有活跃锁时快速返回 `LOCAL_LOCKED`；
- 同主机 PID 已消失且超过 stale 时间时，获取流程可以隔离并清理旧锁；
- 不自动清理其他 hostname 的锁；
- release 前核对随机 token，防止旧进程删除新锁；
- ownership 改变时返回 `LOCK_OWNERSHIP_LOST`；
- `doctor` 只能清理明确满足 stale 条件的锁；
- 默认 stale 时间为 10 分钟。

该锁只解决同一台机器对同一个受管理 clone 的并发写。不同机器之间的并发仍由 Git non-fast-forward、rebase 和 push 重试处理。
