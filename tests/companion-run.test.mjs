import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCRIPT = path.join(ROOT, "scripts", "claude-companion.mjs");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o755 });
  fs.writeFileSync(
    `${filePath}.cmd`,
    `@echo off\r\n"${process.execPath}" "%~dp0${path.basename(filePath)}" %*\r\n`,
    "utf8"
  );
}

function initGitRepo(repo) {
  const result = spawnSync("git", ["init", "-q"], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function installFakeClaude(binDir) {
  const scriptPath = path.join(binDir, "claude");
  const source = `#!/usr/bin/env node
const args = process.argv.slice(2);

if (args.includes("--version")) {
  process.stdout.write("1.0.0\\n");
  process.exit(0);
}

if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("authenticated\\n");
  process.exit(0);
}

if (args[0] === "-p") {
  const sessionId = "cc-run-session";
  if (process.env.FAKE_CLAUDE_STDERR_NOISE === "1") {
    process.stderr.write("fake Claude startup noise\\n");
  }
  const reply = process.env.FAKE_CLAUDE_EMPTY_REPLY === "1" ? "" : "Task complete.";
  process.stdout.write(JSON.stringify({
    type: "result",
    session_id: sessionId,
    result: reply
  }) + "\\n");
  process.exit(0);
}

process.stderr.write("unexpected args: " + JSON.stringify(args) + "\\n");
process.exit(2);
`;
  writeExecutable(scriptPath, source);
  return scriptPath;
}

function makeRunEnv(extra = {}) {
  const root = makeTempDir("cc-run-test-");
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  const repo = path.join(root, "repo");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(repo, { recursive: true });
  const fakeClaude = installFakeClaude(bin);
  initGitRepo(repo);
  return {
    root,
    repo,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CODEX_HOME: path.join(home, ".codex"),
      PATH: `${bin}${path.delimiter}${process.env.PATH || ""}`,
      CLAUDE_COMPANION_CLAUDE_COMMAND_JSON: JSON.stringify([
        process.execPath,
        fakeClaude,
      ]),
      ...extra,
    },
  };
}

function runCompanion(args, options = {}) {
  return spawnSync("node", [SCRIPT, ...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
}

test("run returns mailbox completion and the final Claude Code reply", () => {
  const fixture = makeRunEnv({ FAKE_CLAUDE_STDERR_NOISE: "1" });

  const result = runCompanion(["run", "--write", "Do the thing"], {
    cwd: fixture.repo,
    env: fixture.env,
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
  assert.equal(result.stdout, "Claude Code: completed\nReply:\nTask complete.\n");
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /session|pid|job|result|resume|log/i);
});

test("run omits reply when Claude Code produces no final text", () => {
  const fixture = makeRunEnv({
    FAKE_CLAUDE_EMPTY_REPLY: "1",
    FAKE_CLAUDE_STDERR_NOISE: "1",
  });

  const result = runCompanion(["run", "--write", "Do the thing"], {
    cwd: fixture.repo,
    env: fixture.env,
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
  assert.equal(result.stdout, "Claude Code: completed\n");
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /Reply:|Task finished|Final output|session|pid|job|result|resume|log/i);
});

test("run --json omits reply when Claude Code produces no final text", () => {
  const fixture = makeRunEnv({
    FAKE_CLAUDE_EMPTY_REPLY: "1",
    FAKE_CLAUDE_STDERR_NOISE: "1",
  });

  const result = runCompanion(["run", "--json", "--write", "Do the thing"], {
    cwd: fixture.repo,
    env: fixture.env,
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    process: "Claude Code Run",
    status: "completed",
  });
  assert.doesNotMatch(result.stdout, /reply|Task finished|Final output|session|pid|job|result|resume|log/i);
});
