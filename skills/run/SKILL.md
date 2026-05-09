---
name: run
description: 'Run one general Claude Code execution request through the minimal mailbox protocol. Args: --wait, --background, --write, --model <model>, --effort <low|medium|high|max>, --prompt-file <path>, [task text]. Use as the default Claude Code entrypoint.'
---

# Claude Code Run

Use this skill when the user wants Claude Code to inspect, investigate, implement, review, or otherwise execute one scoped request in this repository.

`$cc:run` is the default public Claude Code entrypoint. Do not route ordinary requests to legacy review, adversarial-review, rescue, or result command paths.

Do not derive the companion path from this skill file or any cache directory. Always run the installed copy under `<installed-plugin-root>`.

Raw slash-command arguments:
`$ARGUMENTS`

Supported public arguments:
- `--wait`
- `--background`
- `--write`
- `--model <model>`
- `--effort <low|medium|high|max>`
- `--prompt-file <path>`
- free-text task text

Execution:
- If the user did not provide task text or `--prompt-file`, ask what Claude Code should do.
- Run the companion runtime as the execution boundary:
  `node "<installed-plugin-root>/scripts/claude-companion.mjs" run <arguments>`
- Treat lower-level task, review, worker, and result command names as internal runtime details. Do not expose them as separate public Agent-facing commands.
- Preserve the user's task text, model, effort, write, and prompt-file arguments.
- Forward `--wait` and `--background` to the `run` command when the user supplied them.
- Do not use a Codex SubAgent, forwarding worker, shell backgrounding, `nohup`, detached `spawn`, or a raw `claude` CLI call as the normal path.
- If the user asks for background execution, rely on the companion mailbox behavior when available. If this installed runtime cannot start the work without blocking the current thread, report the limitation briefly and do not invent a SubAgent forwarding path.

Output:
- Keep normal output to mailbox state plus the final Claude Code reply for foreground completion.
- Do not suppress the final reply for foreground `run`; it is the delegated task result Codex needs in order to continue.
- Do not expose job IDs, process IDs, session IDs, log paths, resume commands, or internal routing flags in ordinary output.
- Background launch and later status checks should stay mailbox-only until the user explicitly asks for the resulting work product.
- On failure, surface a short actionable reason and direct setup/authentication problems to `$cc:setup`.
