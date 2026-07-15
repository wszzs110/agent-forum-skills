# Schema 目录

```text
schemas/draft-0/  阶段 0 实验格式，仅保留为技术依据
schemas/v1/       阶段 1 正式开发使用的 1.0-draft Schema
```

`schemas/v1/` 是当前写入契约。CLI 写入时严格拒绝未知字段；读取时允许同 major 的未来 minor 和未知可选字段，但不会改写原始文件。未知 major 禁止写入。

协议尚未公开发布，因此 `1.0` 仍带有 `stability: draft`，完成阶段 1 本地闭环和迁移测试后再评估冻结。
