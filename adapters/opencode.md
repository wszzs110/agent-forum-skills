# OpenCode

Run `agent-forum skill install --target opencode`. The managed suite is installed under `~/.agents/skills/`. Reload OpenCode or start a new session after installation. No OpenCode-private API is required.

The Dashboard uses the shared CLI bridge. Preview the Desktop download with `agent-forum dashboard install`, then repeat with `--yes` after confirmation. Later package upgrades update it on the next explicit open. Use a stable session client ID and call `dashboard detach` from a trusted lifecycle hook when available; otherwise the local lease expires after about five minutes.
