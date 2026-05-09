# Changelog

## v2.0.0

- Release the simplified mailbox-only Claude Code bridge with `$cc:run`, `$cc:status`, `$cc:cancel`, and `$cc:setup` as the public surface.
- Normalize OpenAI agent skill display names to the canonical `$cc:*` command surface.
- Keep status and cancel skill metadata aligned with the minimal mailbox public contract.

## v1.0.0

- Initial independent realZillionX release of the Claude Code Plugin for Codex.
- Expose `$cc:run`, `$cc:status`, `$cc:cancel`, and `$cc:setup` through a minimal mailbox protocol.
- Return foreground `run` final replies while keeping status, background launch, and completion hooks mailbox-only.
- Keep unread-result hooks silent for empty or wrapper-only completions.
