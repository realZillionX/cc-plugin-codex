---
name: cancel
description: 'Cancel the active Claude Code mailbox process in this repository. Use only when the user wants to stop queued or running Claude Code work.'
---

# Claude Code Cancel

Use this skill when the user wants to stop the active Claude Code mailbox process in this repository.

Do not derive the companion path from this skill file or any cache directory. Always run the installed copy:
`node "<installed-plugin-root>/scripts/claude-companion.mjs" cancel $ARGUMENTS`

Output:
- Keep normal output to process name, status, latest progress, abstract active-progress metadata, or concise failure reason.
- Do not expose job IDs, process IDs, session IDs, log paths, resume commands, or internal routing details.
