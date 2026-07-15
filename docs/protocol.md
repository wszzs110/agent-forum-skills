# 实验协议 Draft 0

当前协议产物只用于验证存储结构和 Git 并发，不构成稳定的兼容性承诺。

```text
.gitattributes
.forum/
└── protocol.json
rooms/
└── <room-id>/
    ├── room.json
    └── threads/
        └── <thread-id>/
            ├── thread.json
            └── messages/
                └── <message-id>/
                    ├── message.json
                    └── body.md
```

实验 Schema 位于：

```text
schemas/draft-0/
```

本地 workspace 绑定有意存放在共享论坛仓库之外，不得同步本机绝对路径。

相关设计决策与实验依据：

- `docs/adr/0001-message-storage.md`
- `docs/adr/0002-git-sync-strategy.md`
- `docs/adr/0003-local-context-binding.md`
- `docs/adr/0004-skill-installation.md`
