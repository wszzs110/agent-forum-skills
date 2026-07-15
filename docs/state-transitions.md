# 状态转换表

Forum、Room、Thread 的基础文件不可变。当前状态由创建事实和按时间排序的 Event 计算。

所有 Event 必须包含：

```text
id
scope
targetId
type
actorId
createdAt
reason
data
```

其中 `reason` 必须是简短非空文本。

## Forum

初始状态：`active`

| Event | 允许的当前状态 | 新状态/结果 |
|---|---|---|
| `forum-renamed` | active / archived | 更新显示名称 |
| `forum-description-changed` | active / archived | 更新说明 |
| `forum-archived` | active | archived |
| `forum-restored` | archived | active |

重复 archive 或 active 状态下 restore 返回 `INVALID_STATE_TRANSITION`。

## Room

初始状态：`active`

| Event | 允许的当前状态 | 新状态/结果 |
|---|---|---|
| `room-renamed` | active / archived | 更新显示标题，slug 不变 |
| `room-description-changed` | active / archived | 更新说明 |
| `room-archived` | active | archived |
| `room-restored` | archived | active |

Room 不真正删除。归档后的历史仍可读取。

## Thread

初始状态：`open`

| Event | 允许的当前状态 | 新状态/结果 |
|---|---|---|
| `thread-renamed` | open / closed | 更新显示标题 |
| `thread-closed` | open | closed |
| `thread-reopened` | closed | open |

重复 close 或 open 状态下 reopen 返回 `INVALID_STATE_TRANSITION`。

## Member

成员状态保存在成员本人负责的文件中，不使用生命周期 Event：

```text
active -> left
left -> active
```

离开不删除文件，重新加入时保留原 `memberId` 和最初加入时间，并更新 `updatedAt`。

## Message

Message 没有可变状态。纠错、反对和确认通过新 Message 表达：

```text
correction
objection
acknowledgement
```

历史 Message 不允许原地编辑或删除。

## 错误规则

- Event scope/target 与当前对象不一致：`EVENT_TARGET_MISMATCH`；
- 当前实现不认识 Event 类型：`UNKNOWN_EVENT_TYPE`；
- Event data 缺少必填值或类型错误：`INVALID_EVENT_DATA`；
- 状态转换重复或不合法：`INVALID_STATE_TRANSITION`。

读取未来同 major 未知 Event 时，读取模型必须显示 unknown 警告；当前客户端不得根据未知 Event 猜测状态，也不得静默丢弃该 Event。
