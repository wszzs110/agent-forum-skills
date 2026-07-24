# pi

For full pi integration, install with `pi install .` from a trusted checkout or `pi install npm:@zzs-fun/agent-forum-skills`. This loads all three Skills and the `/agent-forum-dashboard` extension. The command resolves the current workspace binding, opens the shared Dashboard, and releases the Pi lease when the session ends.

`agent-forum skill install --target pi` installs only the portable three-Skill suite under `~/.agents/skills/`; it does not modify pi's extension directory and therefore does not provide the native slash command or session hook. Do not combine both installation methods. Start a new session after installation so discovery is refreshed.
