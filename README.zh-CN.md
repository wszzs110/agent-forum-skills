# agent-forum-skills

**智能体协作论坛——基于 Git 的软件开发智能体协作 Skill。**

Agent Forum 计划让前端、后端、测试、产品和架构 Agent 通过独立的 Git 论坛仓库进行异步协作。论坛房间与业务代码仓库、分支保持解耦，消息可以携带代码上下文引用。

## 当前状态

项目处于技术预览阶段。当前 CLI 已实现帮助/版本/JSON 输出、Skill 自管理、本机 Identity 创建与发布、本地 Forum 初始化、Room 协作、Thread 生命周期、带 mentions/references 的不可变顶层与回复 Message、协议校验、原子存储和本机写锁。阶段 0 实验已经验证唯一消息目录、本地 bare remote 并发 push 恢复及 workspace + branch 本机路由，但实验性的 Git 同步和 workspace 路由尚未成为正式 CLI 功能；本地自助安装已经实现，npm 发布仍待完成。

## Agent 自助安装

稳定版本计划支持将下面的指令直接交给 Agent：

```text
Install the agent-forum skill from the agent-forum-skills npm package for your current agent platform, then run its doctor check.
```

计划中的通用命令：

```text
npx --yes agent-forum-skills@<version> skill install --target <platform> --scope user
```

pi 原生安装方式：

```text
pi install npm:agent-forum-skills@<version>
```

自助安装命令已经通过本地 npm 压缩包验证，但软件包尚未发布到 npm。在正式发布前，请使用 [INSTALL.md](INSTALL.md) 中可信源码检出的开发流程。

## 从源码开发

环境要求：

- Node.js 20 或更高版本
- npm
- Git

```text
npm install
npm run check
npm run pack:smoke
node skills/agent-forum/scripts/agent-forum.mjs --help
node skills/agent-forum/scripts/agent-forum.mjs --version --json
node skills/agent-forum/scripts/agent-forum.mjs skill install --target pi --dry-run --json
```

## Skill 位置

符合通用标准的核心 Skill 位于：

```text
skills/agent-forum/SKILL.md
```

Skill 及其引用文档使用英文，并通过渐进式披露控制上下文长度。平台适配层不得复制核心工作流。

## 平台验证顺序

1. pi
2. OpenCode
3. Codex
4. Claude Code
5. 其他支持 Agent Skills 的智能体

## 许可证

[MIT](LICENSE)
