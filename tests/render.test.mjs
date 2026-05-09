import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  renderCancelReport,
  renderJobStatusReport,
  renderSetupReport,
  renderStatusReport,
  renderTaskResult,
} from "../scripts/lib/render.mjs";

describe("minimal mailbox rendering", () => {
  it("renders status rows without internal identifiers or result commands", () => {
    const output = renderStatusReport({
      running: [
        {
          id: "task-secret-123",
          title: "Claude Code Run",
          status: "running",
          phase: "tool",
          elapsed: "12s",
          lastActivity: "1s ago",
          progressPreview: ["Using tool: Bash"],
          pid: 4242,
          sessionId: "session-secret",
          threadId: "claude-session-secret",
          logFile: "/tmp/claude-secret.log",
        },
      ],
      latestFinished: {
        id: "review-secret-456",
        title: "Claude Code Review",
        status: "completed",
        rendered: "Raw final result",
      },
      recent: [],
    });

    assert.match(output, /\| Process \| Status \| Phase \| Latest \| Elapsed \| Last activity \|/);
    assert.match(output, /Running tool\./);
    assert.match(output, /Completed\./);
    assert.doesNotMatch(output, /task-secret-123|review-secret-456|session-secret|claude-session-secret|pid|claude-secret|result|resume/i);
  });

  it("renders single-job and cancel reports through the same mailbox table", () => {
    const job = {
      id: "task-secret-123",
      title: "Claude Code Run",
      status: "cancelled",
      errorMessage: "Cancelled by user.",
    };

    const statusOutput = renderJobStatusReport(job);
    const cancelOutput = renderCancelReport(job);

    assert.match(statusOutput, /Cancelled by user\./);
    assert.match(cancelOutput, /Cancelled by user\./);
    assert.doesNotMatch(`${statusOutput}\n${cancelOutput}`, /task-secret-123|pid|session|resume/i);
  });
});

describe("setup and task rendering", () => {
  it("renders setup report", () => {
    const output = renderSetupReport({
      ready: true,
      node: { detail: "v25.0.0" },
      claude: { detail: "1.0.0" },
      auth: { detail: "authenticated" },
      hooks: { detail: "installed" },
      reviewGateEnabled: false,
      actionsTaken: [],
      nextSteps: [],
    });

    assert.match(output, /Claude Code Setup/);
    assert.match(output, /Status: ready/);
  });

  it("renders task result text for internal legacy paths", () => {
    assert.equal(renderTaskResult({ rawOutput: "done" }), "done\n");
  });
});
