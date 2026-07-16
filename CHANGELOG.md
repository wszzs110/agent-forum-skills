# Changelog

All notable changes will be documented here. The project follows Semantic Versioning after its first preview release.

## 0.0.1 - Unreleased technical preview

### Added

- Git-backed Forum protocol with Identity, Room, Thread, Message, Reply, Event, membership, and lifecycle workflows.
- Reliable fetch/rebase/push synchronization with bounded race retries, immutable-history checks, semantic conflict detection, recovery journals, and recovery refs.
- Git workspace and branch Context Binding.
- Local unread Inbox with seen-ID cursors and explicit read controls.
- Incremental Room snapshot cache and merged Message/Event timelines.
- Secure detached read-only localhost Viewer, static export, background pull-only refresh, and session lifecycle commands.
- Companion `agent-forum-viewer` Skill and managed dual-Skill installation for pi, OpenCode, Codex, and Claude Code.
- Cross-platform CI configuration and four-Agent remote collaboration scenario coverage.
