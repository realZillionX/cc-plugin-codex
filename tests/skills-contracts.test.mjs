import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("public surface exports only mailbox skills", () => {
  const skillDirs = fs
    .readdirSync(path.join(ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(skillDirs, ["cancel", "run", "setup", "status"]);
});

test("run skill is the default Claude Code entrypoint", () => {
  const run = read("skills/run/SKILL.md");

  assert.match(run, /\$cc:run` is the default public Claude Code entrypoint/);
  assert.match(run, /claude-companion\.mjs" run <arguments>/);
  assert.match(run, /Do not use a Codex SubAgent/);
  assert.match(run, /Do not suppress the final reply/);
  assert.match(run, /Do not expose job IDs, process IDs, session IDs, log paths, resume commands/);
  assert.doesNotMatch(run, /claude-companion\.mjs" task --background/);
});

test("status and cancel skills keep the mailbox boundary", () => {
  const status = read("skills/status/SKILL.md");
  const cancel = read("skills/cancel/SKILL.md");

  for (const skill of [status, cancel]) {
    assert.match(skill, /Do not derive the companion path from this skill file or any cache directory/);
    assert.match(skill, /minimal|mailbox|process name, status/i);
    assert.match(skill, /Do not expose job IDs, process IDs, session IDs, log paths, resume commands/);
    assert.doesNotMatch(skill, /\$cc:result <job-id>/);
  }
});

test("setup skill uses current hooks feature flag", () => {
  const setup = read("skills/setup/SKILL.md");
  assert.match(setup, /\[features\]\.hooks/);
  assert.match(setup, /not deprecated `\[features\]\.codex_hooks`/);
});
