/**
 * Copyright 2026 realZillionX.
 * SPDX-License-Identifier: Apache-2.0
 */

function normalizeTrailingNewline(text) {
  return `${String(text).replace(/\s*$/, "")}\n`;
}

function pushFeatureHooksFlag(lines) {
  let insertAt = lines.length;
  while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }
  lines.splice(insertAt, 0, "hooks = true");
}

export function ensureCodexHooksEnabled(content) {
  const lines = String(content ?? "").split("\n");
  const next = [];
  let inFeatures = false;
  let foundFeatures = false;
  let foundHooks = false;
  let changed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      if (inFeatures && !foundHooks) {
        pushFeatureHooksFlag(next);
        foundHooks = true;
        changed = true;
      }
      inFeatures = trimmed === "[features]";
      foundFeatures ||= inFeatures;
      next.push(line);
      continue;
    }

    if (inFeatures && /^codex_hooks\s*=/.test(trimmed)) {
      changed = true;
      continue;
    }

    if (inFeatures && /^hooks\s*=/.test(trimmed)) {
      foundHooks = true;
      if (trimmed !== "hooks = true") {
        next.push("hooks = true");
        changed = true;
      } else {
        next.push(line);
      }
      continue;
    }

    next.push(line);
  }

  if (inFeatures && !foundHooks) {
    pushFeatureHooksFlag(next);
    changed = true;
  }

  if (!foundFeatures) {
    if (next.length > 0 && next[next.length - 1].trim() !== "") {
      next.push("");
    }
    next.push("[features]", "hooks = true");
    changed = true;
  }

  return {
    changed,
    content: normalizeTrailingNewline(next.join("\n").replace(/\n{3,}/g, "\n\n")),
  };
}
