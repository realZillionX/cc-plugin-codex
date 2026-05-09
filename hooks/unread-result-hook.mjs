#!/usr/bin/env node

/**
 * Copyright 2026 realZillionX.
 * SPDX-License-Identifier: Apache-2.0
 */

import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readHookInput } from "./lib/hook-input.mjs";
import { cleanupAfterOfficialUninstall } from "./lib/plugin-install-guard.mjs";
import { getConfig, listJobs, patchJob, writeTurnBaseline } from "../scripts/lib/state.mjs";
import { getWorkingTreeFingerprint } from "../scripts/lib/git.mjs";
import { nowIso, SESSION_ID_ENV } from "../scripts/lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "../scripts/lib/workspace.mjs";

const MAX_LISTED_JOBS = 3;
const SKIP_INTERACTIVE_HOOKS_ENV = "CLAUDE_COMPANION_SKIP_INTERACTIVE_HOOKS";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isExplicitClaudeStatusRequest(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  return text.includes("$cc:status");
}

function processName(job) {
  const name = String(job?.title ?? "Claude Code").trim();
  return name || "Claude Code";
}

function nonEmptyString(value) {
  return String(value ?? "").trim() !== "";
}

function nonEmptyStringArray(value) {
  return Array.isArray(value) && value.some((item) => nonEmptyString(item));
}

function hasEffectiveCompletionSignal(job) {
  const result = job?.result;
  return (
    nonEmptyString(result?.rawOutput) ||
    nonEmptyStringArray(result?.touchedFiles)
  );
}

function buildAdditionalContext(jobs) {
  const listed = jobs.slice(0, MAX_LISTED_JOBS).map((job) => `- ${processName(job)}: completed`);
  const remaining = jobs.length - listed.length;
  const intro =
    jobs.length === 1
      ? "Claude Code: completed."
      : `Claude Code: ${jobs.length} completed.`;

  const guidance =
    jobs.length === 1
      ? "Before handling the new request, briefly mention that Claude Code completed. Do not request or surface raw stored output; continue by inspecting the repository state directly when needed. Do not bring this completion up again automatically after this turn."
      : "Before handling the new request, briefly mention that Claude Code processes completed. Do not request or surface raw stored output; continue by inspecting the repository state directly when needed. Do not bring these completions up again automatically after this turn.";

  return [
    intro,
    "",
    "Finished processes:",
    ...listed,
    ...(remaining > 0 ? [`- ${remaining} more: completed`] : []),
    "",
    guidance,
  ].join("\n");
}

function selectUnreadCompletedJobs(workspaceRoot, sessionId) {
  if (!sessionId) {
    return [];
  }

  return listJobs(workspaceRoot)
    .filter((job) => job.sessionId === sessionId)
    .filter((job) => job.status === "completed")
    .filter((job) => !job.resultViewedAt)
    .filter((job) => !job.notifiedAt)
    .filter((job) => !job.notificationSkippedAt)
    .sort((left, right) =>
      String(right.updatedAt ?? right.completedAt ?? "").localeCompare(
        String(left.updatedAt ?? left.completedAt ?? "")
      )
    );
}

function markJobsNotified(workspaceRoot, jobs) {
  const timestamp = nowIso();
  for (const job of jobs) {
    patchJob(workspaceRoot, job.id, {
      notifiedAt: timestamp,
    });
  }
}

function markJobsNotificationSkipped(workspaceRoot, jobs) {
  const timestamp = nowIso();
  for (const job of jobs) {
    patchJob(workspaceRoot, job.id, {
      notificationSkippedAt: timestamp,
      notificationSkippedReason: "no_effective_result",
    });
  }
}

function captureTurnBaseline(workspaceRoot, sessionId, cwd) {
  if (!sessionId) {
    return;
  }
  try {
    const fingerprint = getWorkingTreeFingerprint(cwd);
    writeTurnBaseline(workspaceRoot, sessionId, {
      cwd,
      workspaceRoot,
      capturedAt: nowIso(),
      fingerprint,
    });
  } catch {
    // Baseline capture is best-effort. If it fails, Stop falls back to running review.
  }
}

async function main() {
  const input = readHookInput();
  if (cleanupAfterOfficialUninstall(ROOT_DIR)) {
    return;
  }
  const cwd = input.cwd || process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const sessionId = input.session_id || process.env[SESSION_ID_ENV] || null;
  const prompt = String(input.prompt ?? "");

  if (
    process.env[SKIP_INTERACTIVE_HOOKS_ENV] === "1" ||
    !sessionId
  ) {
    return;
  }

  const config = getConfig(workspaceRoot);
  if (config.stopReviewGate) {
    captureTurnBaseline(workspaceRoot, sessionId, cwd);
  }

  if (isExplicitClaudeStatusRequest(prompt)) {
    return;
  }

  const jobs = selectUnreadCompletedJobs(workspaceRoot, sessionId);
  if (jobs.length === 0) {
    return;
  }

  const notifyJobs = jobs.filter(hasEffectiveCompletionSignal);
  const skippedJobs = jobs.filter((job) => !hasEffectiveCompletionSignal(job));
  if (skippedJobs.length > 0) {
    markJobsNotificationSkipped(workspaceRoot, skippedJobs);
  }
  if (notifyJobs.length === 0) {
    return;
  }

  markJobsNotified(workspaceRoot, notifyJobs);
  process.stdout.write(`${buildAdditionalContext(notifyJobs)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
