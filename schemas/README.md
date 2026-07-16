# Schema 目录

```text
schemas/draft-0/  阶段 0 实验格式，仅保留为技术依据
schemas/v1/       当前正式开发使用的 1.0-draft 协议及本机状态 Schema
```

`schemas/v1/` 是当前写入契约。CLI 写入时严格拒绝未知字段；读取时允许同 major 的未来 minor 和未知可选字段，但不会改写原始文件。未知 major 禁止写入。

协议尚未公开发布，因此 `1.0` 仍带有 `stability: draft`。阶段 1 本地闭环已完成；remote sync、迁移及跨平台测试完成后再评估冻结。`local-config` 和 `context-bindings` 仅校验本机状态，不进入论坛 remote。
