# Claude Code Plugin for Codex

Run Claude Code from Codex through a minimal mailbox protocol.

`@realzillionx/cc-plugin-codex` is a small collaboration bridge:

- Codex owns reasoning and decides what to do next.
- Claude Code owns delegated execution for a clearly scoped request.
- The plugin owns local process state and mailbox rendering.

The public Agent-facing surface is intentionally small:

| Command | Purpose |
| --- | --- |
| `$cc:run` | Start one general Claude Code execution request |
| `$cc:status` | Show the current Claude Code mailbox state |
| `$cc:cancel` | Stop the active Claude Code mailbox process |
| `$cc:setup` | Verify Claude Code CLI, Codex hooks, and optional review gate state |

Legacy review-oriented commands may exist for compatibility during migration, but they are not the default interface and should not be recommended for ordinary use.
Direct legacy runtime commands are disabled by default outside the public mailbox interface.

This repository is maintained by realZillionX.

## Quick Start

### Requirements

- Node.js 18 or newer
- Codex with plugin and hook support
- Claude Code CLI installed and authenticated

Install Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
claude auth login
```

### Install

Use the published npm package:

```bash
npx @realzillionx/cc-plugin-codex install
```

Or use the GitHub package directly:

```bash
npx github:realZillionX/cc-plugin-codex install
```

Or install from a checkout:

```bash
git clone https://github.com/realZillionX/cc-plugin-codex.git ~/.codex/plugins/cc
cd ~/.codex/plugins/cc
node scripts/local-plugin-install.mjs install --plugin-root ~/.codex/plugins/cc
```

Then open Codex and run:

```text
$cc:setup
```

The installer copies plugin files to `~/.codex/plugins/cc`, registers the plugin, enables Codex hooks, and installs managed lifecycle hooks. It is safe to rerun for updates.

## Common Flows

Run a delegated Claude Code task:

```text
$cc:run inspect the current diff and identify the highest-risk issue
```

Run Claude Code with implementation permission:

```text
$cc:run --write fix the flaky auth fallback test with the smallest focused patch
```

Check mailbox state:

```text
$cc:status
```

Cancel active Claude Code work:

```text
$cc:cancel
```

## Mailbox Output

Normal mailbox output is deliberately compact. It should report only:

- process name
- status
- latest progress
- abstract running metadata such as phase, elapsed time, and last activity
- concise failure reason, when failed

Normal status and hook output must not include raw Claude Code results, runtime identifiers, log paths, resume commands, or other internal routing details. Running metadata is lifecycle-level only, for example `responding`, `tool`, or `queued`. Foreground `run` completion returns Claude Code's final reply because that is the delegated task result; later status checks and background completion notices remain mailbox-only. Background completion hooks stay silent for empty or wrapper-only completions without an effective final-text or touched-file signal.

The same boundary applies to public JSON output. `run --json`, `status --json`, and `cancel --json` return sanitized mailbox fields, not stored job records. Running progress is also normalized to lifecycle phrases such as `Claude Code is responding.` or `Running tool.` instead of streaming Claude Code's message text.

## Model Selection

The `--model` flag accepts shortcuts or full Claude model IDs:

| Shortcut | Model |
| --- | --- |
| `sonnet` | `claude-sonnet-4-6` |
| `haiku` | `claude-haiku-4-5` |

The `--effort` flag accepts `low`, `medium`, `high`, or `max`.

## Review Gate

`$cc:setup --enable-review-gate` enables an optional stop-time hook. When Codex is stopped after edits, Claude Code reviews the previous Codex response and returns:

- `ALLOW:` to proceed
- `BLOCK:` to keep the session alive and address a concrete issue

The gate is disabled by default because it can spend tokens on every stop event.

Disable it with:

```text
$cc:setup --disable-review-gate
```

## Development

```bash
npm install
npm test
npm run check
npm pack --dry-run
```

Useful repository layout:

```text
.codex-plugin/plugin.json    Codex plugin manifest
skills/                      Codex skill entrypoints
scripts/claude-companion.mjs Claude Code companion CLI
scripts/lib/                 Runtime, state, install, and rendering helpers
hooks/                       Codex lifecycle, unread result, and review gate hooks
assets/                      Manifest and README visuals
schemas/                     Structured review output schema
```

## Privacy

The plugin sends the prompts, selected repository context, and command output needed for a requested Claude Code task to the locally configured Claude Code CLI. Authentication and network behavior are controlled by your Claude Code CLI and Anthropic credentials. The plugin stores process and mailbox metadata locally under Codex plugin data storage.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
