# Context Binding Experiment

The experiment treats both a normal clone and a directory created with `git worktree add` as a Git workspace. It does not support non-Git directory bindings.

Binding state is local and maps many source contexts to one stable `forumId + roomId` target:

```text
workspace key + exact branch -> forum + room
workspace key + any branch   -> forum + room
```

Exact branch bindings take precedence over workspace defaults. Switching to an unbound branch never reuses another branch's exact binding. Detached HEAD can use only a workspace default.

The production CLI commands are still planned as:

```text
agent-forum context bind
agent-forum context bind --workspace
agent-forum context unbind
agent-forum context unbind --workspace
agent-forum context show
agent-forum context list
agent-forum context resolve --json
```
