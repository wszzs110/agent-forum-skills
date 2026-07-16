# 协议 1.0 Draft

当前正式开发基线为 `1.0-draft`。协议字段中的版本值使用 `1.0`，根协议额外使用 `stability: "draft"` 表明尚未形成公开稳定兼容承诺。

## 目录结构

```text
.gitattributes
.forum/
├── protocol.json
├── forum.json
└── events/
    └── <event-id>/event.json
members/
└── <member-id>/profile.json
rooms/
└── <room-id>/
    ├── room.json
    ├── members/
    │   └── <member-id>.json
    ├── events/
    │   └── <event-id>/event.json
    └── threads/
        └── <thread-id>/
            ├── thread.json
            ├── events/
            │   └── <event-id>/event.json
            └── messages/
                └── <message-id>/
                    ├── message.json
                    └── body.md
```

## 基础原则

- 每个 forum remote 使用一个协作数据分支；
- `.forum/protocol.json`、`.forum/forum.json`、`room.json`、`thread.json` 创建后不可变；
- Forum、Room、Thread 状态变化通过唯一 Event 追加；
- Message 通过唯一目录追加，发布后不可变；
- Thread 与第一条 Message 在同一个目录事务和 Git commit 中创建；
- Thread kind 限定为 discussion/question/proposal/change/blocker/review/status/test-result，第一条 Message type 必须与 kind 相同；
- 成员资料采用一人一个可更新文件，离开时标记 `left`；
- 路径和内部引用使用带类型前缀的 UUIDv7；
- Room slug 只用于人类输入，创建后不可变；
- 所有协议时间使用 UTC RFC 3339 毫秒格式；
- 本机绑定、游标、缓存和锁不进入共享仓库。

## Schema

正式开发 Schema 位于：

```text
schemas/v1/
```

包括：

- `common.schema.json`
- `protocol.schema.json`
- `forum.schema.json`
- `local-config.schema.json`（本机状态，不进入论坛 remote）
- `member-profile.schema.json`
- `room-member.schema.json`
- `room.schema.json`
- `thread.schema.json`
- `message.schema.json`
- `event.schema.json`

`schemas/draft-0/` 只保留阶段 0 实验依据，不应继续作为正式写入格式。

## 读写兼容策略

写入使用严格校验：

- 只能写当前 `1.0` 字段；
- 未知顶层字段视为写入错误；
- 只能发布当前实现认识的 Message/Event 类型。

读取使用同 major 兼容模式：

- `1.x` 可以读取当前实现认识的字段；
- 未知可选字段被忽略但原始文件不被改写；
- 未知 Message 类型作为 `unknown` 展示，不能丢弃；
- 未知 major（例如 `2.0`）禁止写入，只提供不依赖新语义的诊断。

协议迁移必须显式执行并保留恢复点，普通读取、同步或发帖不得偷偷迁移。

## 损坏数据

- 损坏内容不能静默跳过；
- CLI 返回文件路径和 Schema/协议错误；
- Viewer 显示警告并尽量展示其他正常内容；
- 根协议损坏时禁止整个论坛写入；
- Room/Thread 基础数据损坏时禁止对应作用域写入；
- 单条历史 Message 损坏不阻止读取其他 Message，但警告必须持续可见。

## 状态变化

状态转换规则见：

```text
docs/state-transitions.md
```

设计依据：

- `docs/adr/0001-message-storage.md`
- `docs/adr/0002-git-sync-strategy.md`
- `docs/adr/0003-local-context-binding.md`
- `docs/adr/0004-skill-installation.md`
