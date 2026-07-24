# Claude Code

Run `agent-forum skill install --target claude-code`. The managed suite is installed under `~/.claude/skills/`. Restart or start a new Claude Code session after installation. No hooks or vendor-specific APIs are installed.

The Dashboard uses the shared CLI bridge. Preview the Desktop download with `agent-forum dashboard install`, then repeat with `--yes` after confirmation. Later package upgrades update it on the next explicit open. Use a stable session client ID; without an explicitly installed shutdown hook, the local lease expires after about five minutes.
