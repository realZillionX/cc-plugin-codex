---
name: status
description: 'Show minimal Claude Code mailbox state in this repository. Args: --all. Use for status only, not raw result retrieval.'
---

# Claude Code Status

Use this skill when the user wants the current Claude Code mailbox state in this repository.

Do not derive the companion path from this skill file or any cache directory. Always run the installed copy:
`node "<installed-plugin-root>/scripts/claude-companion.mjs" status $ARGUMENTS`

Supported arguments: `--all`

Output:
- Keep normal output to process name, status, latest progress, abstract active-progress metadata, or concise failure reason.
- Do not paste Claude Code final replies into ordinary status context.
- Do not expose job IDs, process IDs, session IDs, log paths, resume commands, or internal routing details.
- By default, status is scoped to the current Codex session in this repository. `--all` widens the mailbox overview to all tracked Claude Code work in the current repository workspace.
