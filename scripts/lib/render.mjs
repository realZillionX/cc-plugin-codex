/**
 * Copyright 2026 Sendbird, Inc.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Derived from OpenAI's codex-plugin-cc and modified for Claude Code delegation.
 *
 * Output rendering — adapted from codex-plugin-cc.
 * All "Codex" labels → "Claude Code".
 */

function severityRank(severity) {
  switch (severity) {
    case "critical": return 0;
    case "high": return 1;
    case "medium": return 2;
    default: return 3;
  }
}

function formatLineRange(finding) {
  if (!finding.line_start) return "";
  if (!finding.line_end || finding.line_end === finding.line_start) return `:${finding.line_start}`;
  return `:${finding.line_start}-${finding.line_end}`;
}

export function validateReviewResultShape(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Expected a top-level JSON object.";
  if (typeof data.verdict !== "string" || !data.verdict.trim()) return "Missing string `verdict`.";
  if (typeof data.summary !== "string" || !data.summary.trim()) return "Missing string `summary`.";
  if (!Array.isArray(data.findings)) return "Missing array `findings`.";
  if (!Array.isArray(data.next_steps)) return "Missing array `next_steps`.";
  return null;
}

function normalizeReviewFinding(finding, index) {
  const source = finding && typeof finding === "object" && !Array.isArray(finding) ? finding : {};
  const lineStart = Number.isInteger(source.line_start) && source.line_start > 0 ? source.line_start : null;
  const lineEnd = Number.isInteger(source.line_end) && source.line_end > 0 && (!lineStart || source.line_end >= lineStart) ? source.line_end : lineStart;
  return {
    severity: typeof source.severity === "string" && source.severity.trim() ? source.severity.trim() : "low",
    title: typeof source.title === "string" && source.title.trim() ? source.title.trim() : `Finding ${index + 1}`,
    body: typeof source.body === "string" && source.body.trim() ? source.body.trim() : "No details provided.",
    file: typeof source.file === "string" && source.file.trim() ? source.file.trim() : "unknown",
    line_start: lineStart,
    line_end: lineEnd,
    recommendation: typeof source.recommendation === "string" ? source.recommendation.trim() : "",
  };
}

function normalizeReviewResultData(data) {
  return {
    verdict: data.verdict.trim(),
    summary: data.summary.trim(),
    findings: data.findings.map((f, i) => normalizeReviewFinding(f, i)),
    next_steps: data.next_steps.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()),
  };
}

export function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function collectStatusRows(report) {
  const rows = [
    ...(Array.isArray(report.running) ? report.running : []),
    report.latestFinished,
    ...(Array.isArray(report.recent) ? report.recent : []),
  ].filter(Boolean);

  const seen = new Set();
  return rows
    .filter((job) => {
      if (!job?.id || seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    })
    .sort((left, right) =>
      String(
        right.updatedAt ??
          right.completedAt ??
          right.startedAt ??
          right.createdAt ??
          ""
      ).localeCompare(
        String(
          left.updatedAt ??
            left.completedAt ??
            left.startedAt ??
            left.createdAt ??
            ""
        )
      )
    );
}

function shortText(value, fallback = "") {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized;
}

function mailboxProcessName(job) {
  return shortText(job?.title, "Claude Code");
}

function sanitizeReasonDetail(value) {
  return shortText(value)
    .replace(/\bprocess\s+\d+\b/gi, "Claude Code process")
    .replace(/\bpid\s*=?\s*\d+\b/gi, "process")
    .replace(/\bsession\s+[\w.-]+\b/gi, "session")
    .replace(/(?:[A-Za-z]:)?\/\S+/g, "local path");
}

function sanitizeProgressDetail(value) {
  const line = shortText(value);
  if (!line) return "";
  if (/^Claude Code is responding\.?$/i.test(line)) return "Claude Code is responding.";
  if (/^Using tool:/i.test(line) || /^Running tool\.?$/i.test(line) || /^Running:/i.test(line) || /^tool_use:/i.test(line)) {
    return "Running tool.";
  }
  if (/^API retry/i.test(line)) return "Retrying API request.";
  if (/^Queued/i.test(line)) return "Queued.";
  if (/^Starting Claude/i.test(line)) return "Starting Claude Code.";
  if (/^Cancelling/i.test(line) || /cancel/i.test(line)) return "Cancelling.";
  if (/fail|error/i.test(line)) return "Claude Code reported a failure.";
  return "In progress.";
}

function normalizeFailureReason(job) {
  const detail = sanitizeReasonDetail(job?.errorMessage ?? job?.note ?? "");
  const lowerDetail = detail.toLowerCase();
  switch (job?.status) {
    case "cancelled":
      return detail || "Cancelled by user. Start a new Claude Code run if work is still needed.";
    case "cancel_failed":
      return detail || "Cancel did not complete. Check whether Claude Code is still running before starting another run.";
    case "failed":
      if (lowerDetail.includes("claude code process died without completing")) {
        return "Claude Code stopped before completing. Rerun the request if work is still needed.";
      }
      if (lowerDetail.includes("enoent") || lowerDetail.includes("not found")) {
        return "Claude Code CLI is unavailable. Run setup, confirm Claude Code is installed, then rerun.";
      }
      if (lowerDetail.includes("auth") || lowerDetail.includes("unauthorized") || lowerDetail.includes("login")) {
        return "Claude Code needs authentication. Sign in or refresh auth, then rerun.";
      }
      return detail || "Claude Code failed before completing. Check setup, narrow the request, or rerun.";
    default:
      return detail;
  }
}

function latestMailboxProgress(job) {
  if (job?.status === "completed") return "Completed.";
  if (job?.status === "failed" || job?.status === "cancelled" || job?.status === "cancel_failed") {
    return normalizeFailureReason(job);
  }
  if (Array.isArray(job?.progressPreview) && job.progressPreview.length > 0) {
    return sanitizeProgressDetail(job.progressPreview.at(-1)) || "In progress.";
  }
  if (job?.status === "queued") return "Queued.";
  if (job?.status === "cancelling") return "Cancelling.";
  if (job?.phase && job.phase !== job.status) return shortText(job.phase, "In progress.");
  return "In progress.";
}

function renderMailboxStatusRows(rows) {
  const lines = [
    "| Process | Status | Phase | Latest | Elapsed | Last activity |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const job of rows) {
    lines.push(
      `| ${escapeMarkdownCell(mailboxProcessName(job))} | ${escapeMarkdownCell(job.status ?? "unknown")} | ${escapeMarkdownCell(job.phase ?? "")} | ${escapeMarkdownCell(latestMailboxProgress(job))} | ${escapeMarkdownCell(job.elapsed ?? job.duration ?? "")} | ${escapeMarkdownCell(job.lastActivity ?? "")} |`
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function appendReasoningSection(lines, reasoningSummary) {
  if (!Array.isArray(reasoningSummary) || reasoningSummary.length === 0) return;
  lines.push("", "Reasoning:");
  for (const section of reasoningSummary) lines.push(`- ${section}`);
}

export function renderSetupReport(report) {
  const lines = [
    "# Claude Code Setup",
    "",
    `Status: ${report.ready ? "ready" : "needs attention"}`,
    "",
    "Checks:",
    `- node: ${report.node.detail}`,
    `- claude: ${report.claude.detail}`,
    `- auth: ${report.auth.detail}`,
    `- hooks: ${report.hooks.detail}`,
    `- review gate: ${report.reviewGateEnabled ? "enabled" : "disabled"}`,
    "",
  ];
  if (report.actionsTaken.length > 0) {
    lines.push("Actions taken:");
    for (const action of report.actionsTaken) lines.push(`- ${action}`);
    lines.push("");
  }
  if (report.nextSteps.length > 0) {
    lines.push("Next steps:");
    for (const step of report.nextSteps) lines.push(`- ${step}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderReviewResult(parsedResult, meta) {
  if (!parsedResult.parsed) {
    if (parsedResult.rawOutput) {
      // Claude responded in natural language — show it directly instead of as an error
      const lines = [`# Claude Code ${meta.reviewLabel}`, "", `Target: ${meta.targetLabel}`, "", parsedResult.rawOutput];
      appendReasoningSection(lines, meta.reasoningSummary ?? parsedResult.reasoningSummary);
      return `${lines.join("\n").trimEnd()}\n`;
    }
    const lines = [`# Claude Code ${meta.reviewLabel}`, "", "Claude Code did not return output.", "", `- Error: ${parsedResult.parseError}`];
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const validationError = validateReviewResultShape(parsedResult.parsed);
  if (validationError) {
    const lines = [`# Claude Code ${meta.reviewLabel}`, "", `Target: ${meta.targetLabel}`, "Claude Code returned JSON with an unexpected review shape.", "", `- Validation error: ${validationError}`];
    if (parsedResult.rawOutput) lines.push("", "Raw final message:", "", "```text", parsedResult.rawOutput, "```");
    appendReasoningSection(lines, meta.reasoningSummary ?? parsedResult.reasoningSummary);
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const data = normalizeReviewResultData(parsedResult.parsed);
  const findings = [...data.findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const lines = [`# Claude Code ${meta.reviewLabel}`, "", `Target: ${meta.targetLabel}`, `Verdict: ${data.verdict}`, "", data.summary, ""];
  if (findings.length === 0) {
    lines.push("No material findings.");
  } else {
    lines.push("Findings:");
    for (const f of findings) {
      const ls = formatLineRange(f);
      lines.push(`- [${f.severity}] ${f.title} (${f.file}${ls})`);
      lines.push(`  ${f.body}`);
      if (f.recommendation) lines.push(`  Recommendation: ${f.recommendation}`);
    }
  }
  if (data.next_steps.length > 0) {
    lines.push("", "Next steps:");
    for (const step of data.next_steps) lines.push(`- ${step}`);
  }
  appendReasoningSection(lines, meta.reasoningSummary);
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderTaskResult(parsedResult) {
  const rawOutput = typeof parsedResult?.rawOutput === "string" ? parsedResult.rawOutput : "";
  if (rawOutput) return rawOutput.endsWith("\n") ? rawOutput : `${rawOutput}\n`;
  const message = String(parsedResult?.failureMessage ?? "").trim() || "Claude Code did not return a final message.";
  return `${message}\n`;
}

export function renderStatusReport(report) {
  const rows = collectStatusRows(report).slice(0, 15);
  if (rows.length === 0) return "No Claude Code jobs recorded yet.\n";
  return renderMailboxStatusRows(rows);
}

export function renderJobStatusReport(job) {
  return renderMailboxStatusRows([job]);
}

export function renderCancelReport(job) {
  return renderMailboxStatusRows([job]);
}
