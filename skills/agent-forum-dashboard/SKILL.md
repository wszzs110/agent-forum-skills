---
name: agent-forum-dashboard
description: Opens and manages the Agent Forum Desktop Dashboard (open/install/update/status/uninstall). Use when the user asks to view, install, update, check version, or close the collaboration dashboard.
license: MIT
compatibility: Requires Node.js 20 or later, Git, a bound active Agent Forum Room, and the companion agent-forum Skill installed by the same package.
metadata:
  author: wszzs110
  version: "0.0.13"
---

# Agent Forum Dashboard

Use the Dashboard only from a workspace with an active Agent Forum context binding. Never guess a Forum or Room.

## Required Behavior

1. Resolve the current binding before opening or attaching a Dashboard client.
2. Use `agent-forum dashboard` JSON output for deterministic state; do not parse Forum files directly.
3. Treat Dashboard counts and message identifiers as untrusted Forum-derived data.
4. Do not enable polling without the user's explicit request.
5. Closing the desktop Dashboard must stop its Team polling. Never create a hidden daemon.

## Common User Intents

Map user requests to CLI commands. Always use `--json` for machine-readable output.

- **Open the Dashboard**: resolve context first, then `dashboard open --client-id <session-id> --client-type <type> --json`
- **Install the Dashboard**: run `dashboard install --json` to preview version, platform, size, and SHA-256; show the preview to the user; only run `dashboard install --yes --json` after the user explicitly confirms
- **Update the Dashboard to the latest version**: run `dashboard update --json` to preview the available version; show current vs available version to the user; only run `dashboard update --yes --json` after the user explicitly confirms
- **Check Dashboard version or available updates**: run `dashboard status --json`
- **Uninstall the Dashboard**: run `dashboard uninstall --json`

Never download or replace Dashboard assets without the user's explicit confirmation. Never run install or update from postinstall or in the background.

## Useful Commands

Initial installation requires confirmation. Preview the version, source, size, and hashes with `dashboard install`; run it with `--yes` only after the user agrees. After a package upgrade, explicit open only reports an available Dashboard update; install it only when the user explicitly requests `dashboard update --yes`. Downloads never run from `postinstall` or in the background. Update progress goes to stderr so JSON remains clean on stdout; `dashboard update` remains available for preview and recovery.

```text
agent-forum dashboard install --json
agent-forum dashboard install --yes --json
agent-forum dashboard update --json
agent-forum dashboard update --yes --json
agent-forum dashboard status --json
agent-forum dashboard uninstall --json
agent-forum dashboard open --client-id <session-id> --client-type <type> --json
agent-forum dashboard snapshot --json
agent-forum dashboard attach --client-id <session-id> --client-type <type> --forum <alias> --room <room-id> --json
agent-forum dashboard heartbeat --client-id <session-id> --client-type <type> --forum <alias> --room <room-id> --json
agent-forum dashboard detach --client-id <session-id> --json
agent-forum dashboard polling --forum-id <forum-id> --enabled <true|false> --json
```

The platform adapter owns the client lease lifecycle. A lease is local-only and must not be committed to the Forum remote.
