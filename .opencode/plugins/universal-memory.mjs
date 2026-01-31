import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function roleNorm(role) {
  return String(role || "").toLowerCase();
}

function joinPartsText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      if (!p || typeof p !== "object") return "";
      if (typeof p.text === "string") return p.text;
      if (typeof p.content === "string") return p.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function truncate(text, maxChars) {
  if (!isNonEmptyString(text)) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[truncated to ${maxChars} chars]`;
}

function hashExchange(userText, aiText) {
  return createHash("sha256")
    .update(userText)
    .update("\n---\n")
    .update(aiText)
    .digest("hex");
}

function findUp(startDir, relativeTarget) {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, relativeTarget);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function runCommand(command, args, input, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.write(input);
    child.stdin.end();
  });
}

async function recordViaUniversalMemory(payload, cwd) {
  const input = JSON.stringify(payload);

  if (isNonEmptyString(process.env.UNIVERSAL_MEMORY_RECORD_COMMAND)) {
    const cmd = process.env.UNIVERSAL_MEMORY_RECORD_COMMAND;
    const args = isNonEmptyString(process.env.UNIVERSAL_MEMORY_RECORD_ARGS)
      ? process.env.UNIVERSAL_MEMORY_RECORD_ARGS.split(/\s+/).filter(Boolean)
      : [];
    const res = await runCommand(cmd, args, input, cwd);
    if (res.code === 0) return { ok: true, id: res.stdout.trim() };
  }

  const direct = await runCommand(
    "universal-memory-record",
    ["--json"],
    input,
    cwd,
  );
  if (direct.code === 0) return { ok: true, id: direct.stdout.trim() };

  const npx = await runCommand(
    "npx",
    [
      "-y",
      "--package",
      "universal-memory-mcp",
      "universal-memory-record",
      "--json",
    ],
    input,
    cwd,
  );
  if (npx.code === 0) return { ok: true, id: npx.stdout.trim() };

  const distPath = findUp(
    cwd,
    path.join("packages", "mcp-server", "dist", "record.js"),
  );
  if (!distPath) {
    return {
      ok: false,
      error: direct.stderr || npx.stderr || "record command not available",
    };
  }

  const fallback = await runCommand("node", [distPath, "--json"], input, cwd);
  if (fallback.code === 0) return { ok: true, id: fallback.stdout.trim() };

  return {
    ok: false,
    error:
      fallback.stderr ||
      fallback.stdout ||
      direct.stderr ||
      npx.stderr ||
      "record command failed",
  };
}

async function fetchLastExchange(client, sessionId) {
  const response = await client.session.messages({ path: { id: sessionId } });
  const items = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  const normalized = items
    .map((item) => {
      const info =
        item?.info ?? item?.message ?? item?.data?.info ?? item?.data?.message;
      const parts = item?.parts ?? item?.data?.parts;
      const role = info?.role ?? info?.type ?? info?.author;
      const text =
        joinPartsText(parts) ||
        (typeof info?.text === "string" ? info.text : "");
      return { role: roleNorm(role), text: text.trim() };
    })
    .filter((m) => m.role && isNonEmptyString(m.text));

  const lastUserIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === "user") return i;
    }
    return -1;
  })();

  const lastAssistantIdxAfterUser = (() => {
    if (lastUserIdx === -1) return -1;
    for (let i = lastUserIdx + 1; i < normalized.length; i++) {
      if (normalized[i].role === "assistant") return i;
    }
    return -1;
  })();

  const lastAssistantIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === "assistant") return i;
    }
    return -1;
  })();

  const userText = lastUserIdx !== -1 ? normalized[lastUserIdx].text : "";
  const aiText =
    lastAssistantIdxAfterUser !== -1
      ? normalized[lastAssistantIdxAfterUser].text
      : lastAssistantIdx !== -1
        ? normalized[lastAssistantIdx].text
        : "";

  return { userText, aiText };
}

export const UniversalMemoryPlugin = async ({
  project,
  client,
  directory,
  worktree,
}) => {
  const lastRecorded = new Map();
  const projectName =
    (project && (project.name || project.slug || project.id)) ||
    path.basename(worktree || directory || process.cwd());

  return {
    event: async ({ event }) => {
      try {
        if (!event || event.type !== "session.idle") return;

        const sessionId = event.properties?.sessionID;
        if (!isNonEmptyString(sessionId)) return;

        const { userText, aiText } = await fetchLastExchange(client, sessionId);
        if (!isNonEmptyString(userText) || !isNonEmptyString(aiText)) return;

        const userMessage = truncate(userText, 8000);
        const aiResponse = truncate(aiText, 20000);
        const exchangeHash = hashExchange(userMessage, aiResponse);

        if (lastRecorded.get(sessionId) === exchangeHash) return;
        lastRecorded.set(sessionId, exchangeHash);

        const payload = {
          user_message: userMessage,
          ai_response: aiResponse,
          project: projectName,
          client: "opencode",
          session_id: sessionId,
          working_directory: directory || process.cwd(),
        };

        const res = await recordViaUniversalMemory(
          payload,
          directory || process.cwd(),
        );
        if (!res.ok) {
          process.stderr.write(
            `universal-memory opencode plugin warning: ${res.error}\n`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `universal-memory opencode plugin error: ${message}\n`,
        );
      }
    },
  };
};

export default UniversalMemoryPlugin;
