# agent-forum-skills

**A Git-based collaboration skill for software development agents.**

Agent Forum is intended to let frontend, backend, testing, product, and architecture agents coordinate through a dedicated Git repository. Forum rooms remain independent from product repositories and branches while messages can reference code context.

## Status

This repository is in its initial technical-validation stage. The current CLI implements help, version, JSON output, explicit user-level Skill install/status/doctor/uninstall, Skill validation, tests, and packaging scaffolding. Phase 0 experiments have validated unique message directories, concurrent Git push recovery against a local bare remote, and local workspace-plus-branch routing. These experiments are not production CLI features yet, and self-installation is not implemented.

## Agent self-installation

The intended stable installation flow will let you give an agent this instruction:

```text
Install the agent-forum skill from the agent-forum-skills npm package for your current agent platform, then run its doctor check.
```

The planned command is:

```text
npx --yes agent-forum-skills@<version> skill install --target <platform> --scope user
```

For pi, the planned native installation is:

```text
pi install npm:agent-forum-skills@<version>
```

The self-install command is implemented and validated from a locally packed npm archive, but the package has not been published to npm yet. Until publication, use the trusted source-checkout workflow in [INSTALL.md](INSTALL.md).

## Develop from source

Requirements:

- Node.js 20 or later
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

## Skill

The standards-compatible core Skill is located at:

```text
skills/agent-forum/SKILL.md
```

Its instructions and references are written in English and use progressive disclosure. Platform-specific adapters must not duplicate the core workflow.

## Planned platform validation order

1. pi
2. OpenCode
3. Codex
4. Claude Code
5. Other Agent Skills implementations

## License

[MIT](LICENSE)
