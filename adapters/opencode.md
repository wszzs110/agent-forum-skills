# OpenCode

Run `agent-forum skill install --target opencode`. The managed suite is installed under `~/.agents/skills/`. Reload OpenCode or start a new session after installation. No OpenCode-private API is required.

The Dashboard uses the shared CLI bridge and the private `dashboard policy` shared by every Agent platform. Before opening, run `dashboard ensure --json`: `managed` completes verified acquisition and recovery autonomously after one user-approved policy choice; `ask` requires one concise Agent question; `manual` returns the official browser download path. Do not repeat confirmations for resume, locks, checksums, or extraction. A normal open never updates a working Dashboard; use `dashboard ensure --update` only on an explicit user request. Use a stable session client ID and call `dashboard detach` from a trusted lifecycle hook when available; otherwise the local lease expires after about five minutes.
