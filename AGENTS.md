# To-Do Tasks

No active tasks.

# Project Overview

`cc-plugin-codex` is an independent realZillionX-maintained Codex plugin that exposes Claude Code as a companion executor through a minimal mailbox protocol. The desired boundary is that Codex owns reasoning, Claude Code owns delegated execution, and the plugin owns local process and mailbox state.

The public Agent-facing contract should be small: one general execution interface, status, cancel, and setup. Normal status must not inject raw Claude Code output or runtime identifiers into model context. Public JSON output follows the same mailbox boundary and must not return stored job objects. Foreground `run` completion must return Claude Code's final reply because that is the delegated task result Codex needs in order to continue. Background launch, completion hooks, and later status checks remain mailbox-only unless the user explicitly asks for the resulting work product. Running work may expose one normalized lifecycle progress line plus abstract lifecycle metadata such as phase, elapsed time, and last activity. Failures should expose a normalized, actionable reason directly in status.

The current public surface is `$cc:run`, `$cc:status`, `$cc:cancel`, and `$cc:setup`. Legacy review, adversarial-review, task, and result runtime commands are gated behind an explicit compatibility environment variable and are not exported as Agent-facing skills. Stale rescue/result forwarding documentation must not be packaged.

# Repository Analysis

Entry points:
- `.codex-plugin/plugin.json` defines the Codex plugin metadata and exported skills directory.
- `scripts/installer-cli.mjs` installs or updates the package into `~/.codex/plugins/cc`.
- `scripts/local-plugin-install.mjs` registers the plugin with Codex and installs hooks or fallback skill wrappers.
- Hook installation enables `[features].hooks = true` and removes the deprecated `[features].codex_hooks` flag when it rewrites local Codex config.
- `scripts/claude-companion.mjs` is the runtime CLI used by all `$cc:*` skills.

Core data flow:
- Current public skills expose run, status, cancel, and setup only.
- `scripts/claude-companion.mjs` contains the public `run` command, foreground execution, and detached worker execution for internal task compatibility. Normal execution no longer requires a Codex SubAgent forwarding layer.
- Direct legacy companion commands are unavailable by default unless `CLAUDE_COMPANION_ENABLE_LEGACY_COMMANDS=1` is set for compatibility tests or migration work.
- `scripts/lib/claude-cli.mjs` calls Claude Code CLI through streaming JSON. This remains the core model boundary. Streaming text is recorded internally but public status only exposes normalized lifecycle progress.
- `scripts/lib/state.mjs` and `scripts/lib/tracked-jobs.mjs` store internal job metadata, process identity, logs, and rendered payloads. These details remain internal and must not appear in ordinary Agent-facing output.
- `scripts/lib/render.mjs` renders normal status, single-job status, and cancel output as a minimal mailbox view with process, status, and latest progress or reason. Stored result compatibility still exists internally but is not public.
- `hooks/unread-result-hook.mjs` injects minimal completion mailbox context only when the completed job has an effective final-text or touched-file signal. Empty or wrapper-only completions are marked internally as skipped and do not occupy model context.

Build configuration:
- `npm test` runs focused Node test files in `tests/`.
- `npm run check` runs version checks, changelog checks, lint, typecheck, tests, and package validation paths.
- `.github/workflows/ci.yml` runs the release-facing validation matrix.
