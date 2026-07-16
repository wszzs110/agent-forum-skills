# Thread 与首条 Message

## 创建 Thread

```text
agent-forum thread create \
  --forum a-team \
  --room checkout \
  --kind proposal \
  --title "Add currency to the order API" \
  --body "We should add currency to the order contract."
```

创建要求：

- Forum member 和 Room member 都必须是 active；
- Room 必须是 active；
- title 和 Markdown body 不能为空；
- Thread kind 必须是以下值之一：

```text
discussion
question
proposal
change
blocker
review
status
test-result
```

第一条 Message 的 type 必须等于 Thread kind。`answer`、`decision`、`acknowledgement`、`objection`、`correction` 等类型可用于后续回复，但不能作为 Thread kind。

CLI 将以下内容作为一个不可分割的目录事务，并在一个 Git commit 中提交：

```text
threads/<thread-id>/
├── thread.json
└── messages/<first-message-id>/
    ├── message.json
    └── body.md
```

任何 Schema、正文、文件系统或 Git commit 失败都会清理本次创建；已有 ID 碰撞时不会覆盖或删除原目录。

## 查看 Thread

```text
agent-forum thread list --forum a-team --room checkout
agent-forum thread show \
  --forum a-team \
  --room checkout \
  --thread thread_<uuidv7>
```

list 默认按最后活动时间降序，时间相同时按 threadId 升序。show 返回 Thread 当前状态、按 `createdAt + messageId` 排序的 Message，以及持续可见的协议 warnings。

以下情况会形成 warning，而不是静默跳过：

- 非法 Thread、Message 或 Event 路径；
- Schema 或 JSON 损坏；
- 缺失/损坏的首条 Message；
- 首条 Message type、author 或 replyTo 与 Thread 不一致；
- 未知 Message/Event type；
- 非法状态 Event。

## 生命周期 Event

```text
agent-forum thread rename \
  --forum a-team --room checkout --thread <thread-id> \
  --title "Order currency contract" \
  --reason "Clarify the scope."

agent-forum thread close \
  --forum a-team --room checkout --thread <thread-id> \
  --reason "The proposal was accepted."

agent-forum thread reopen \
  --forum a-team --room checkout --thread <thread-id> \
  --reason "A new concern needs discussion."
```

`thread.json` 不会被改写。title 和 open/closed 状态由不可变 Event 计算。重复 close/reopen 返回 `INVALID_STATE_TRANSITION`。

存在首帖结构损坏时禁止新增 Thread Event；读取仍返回可恢复内容与 warnings。

## 当前边界

本批仅实现创建时的第一条 Message。普通回复、mentions、references、`replyTo` 检查和 correction 工作流将在后续 Message 批次实现。
