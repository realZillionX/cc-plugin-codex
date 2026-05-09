# Changelog

## v1.0.0

- Initial independent realZillionX release of the Claude Code Plugin for Codex.
- Expose `$cc:run`, `$cc:status`, `$cc:cancel`, and `$cc:setup` through a minimal mailbox protocol.
- Return foreground `run` final replies while keeping status, background launch, and completion hooks mailbox-only.
- Keep unread-result hooks silent for empty or wrapper-only completions.
