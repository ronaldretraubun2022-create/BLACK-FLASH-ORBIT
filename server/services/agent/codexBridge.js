const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { getChangedFiles, getRepositoryStatus } = require("./repositoryInspector");
const { createSafeChildEnv } = require("./commandAllowlist");
const { redactObject, redactText, summarizeOutput } = require("./redaction");

const CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const CODEX_STATUS_TIMEOUT_MS = 5000;
const MAX_CODEX_OUTPUT_CHARS = 50000;
const CODEX_ENTRYPOINT_SEGMENTS = ["node_modules", "@openai", "codex", "bin", "codex.js"];
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

function createCodexError(message, statusCode = 503, code = "AGENT_CODEX_NOT_FOUND") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeTaskText(value) {
  const taskText = redactText(value, 4000).trim();

  if (taskText.length < 8) {
    const error = new Error("Task repair terlalu pendek.");
    error.statusCode = 400;
    error.code = "AGENT_TASK_REQUIRED";
    throw error;
  }

  return taskText;
}

function appendBounded(current, chunk) {
  return `${current}${chunk}`.slice(0, MAX_CODEX_OUTPUT_CHARS);
}

function isNetworkOrDevicePath(value) {
  const rawPath = String(value || "");

  return rawPath.startsWith("\\\\") || rawPath.startsWith("//") || /^\\\\[.?]\\/.test(rawPath);
}

function isTrustedCodexEntrypoint(realPath) {
  const segments = realPath.replace(/\\/g, "/").split("/").map((segment) => segment.toLowerCase());
  const suffix = segments.slice(-CODEX_ENTRYPOINT_SEGMENTS.length);

  return CODEX_ENTRYPOINT_SEGMENTS.every((segment, index) => suffix[index] === segment);
}

function validateCodexEntrypoint(candidatePath) {
  const rawPath = String(candidatePath || "").trim();

  if (!rawPath || rawPath.includes("\0") || isNetworkOrDevicePath(rawPath)) {
    throw createCodexError("Codex entrypoint tidak valid.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  let realPath;
  let stat;

  try {
    realPath = fs.realpathSync.native(path.resolve(rawPath));
    stat = fs.statSync(realPath);
  } catch {
    throw createCodexError("Codex entrypoint tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  if (!stat.isFile()) {
    throw createCodexError("Codex entrypoint bukan file valid.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  if (!isTrustedCodexEntrypoint(realPath)) {
    throw createCodexError("Codex entrypoint tidak berada dalam paket @openai/codex.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  return realPath;
}

function readNpmGlobalRoot() {
  const result = spawnSync(npmExecutable, ["root", "-g"], {
    encoding: "utf8",
    env: createSafeChildEnv(),
    shell: false,
    timeout: CODEX_STATUS_TIMEOUT_MS,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) return "";

  return String(result.stdout || "").split(/\r?\n/)[0]?.trim() || "";
}

function getTrustedCodexCandidates() {
  const configured = String(process.env.ORBIT_CODEX_ENTRYPOINT || "").trim();

  if (configured) return [configured];

  const roots = [];

  if (process.platform === "win32" && process.env.APPDATA) {
    roots.push(path.join(process.env.APPDATA, "npm", "node_modules"));
  }

  roots.push(readNpmGlobalRoot());

  return Array.from(new Set(roots.filter(Boolean))).map((root) =>
    path.join(root, "@openai", "codex", "bin", "codex.js"),
  );
}

function resolveCodexEntrypoint() {
  const candidates = getTrustedCodexCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return validateCodexEntrypoint(candidate);
    } catch (error) {
      lastError = error;
      if (process.env.ORBIT_CODEX_ENTRYPOINT) break;
    }
  }

  throw lastError || createCodexError("Codex CLI tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
}

function mapCodexError(error) {
  if (error?.code === "ENOENT") {
    return createCodexError("Codex CLI tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  if (error?.code === "EACCES" || error?.code === "EPERM") {
    return createCodexError("Codex CLI tidak dapat dieksekusi.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  if (error?.code === "ETIMEDOUT" || error?.code === "AGENT_CODEX_TIMEOUT") {
    return createCodexError("Codex CLI melewati batas waktu.", 504, "AGENT_CODEX_TIMEOUT");
  }

  if (error?.code && /^AGENT_CODEX_/.test(error.code)) return error;

  return createCodexError("Codex CLI gagal dijalankan.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
}

function buildCodexFailureResult({ error, startedAt }) {
  const mapped = mapCodexError(error);
  const exitCode = mapped.code === "AGENT_CODEX_TIMEOUT" ? 124 : mapped.code === "AGENT_CODEX_NOT_EXECUTABLE" ? 126 : 127;

  return {
    changedFiles: [],
    durationMs: Date.now() - startedAt,
    errorCode: mapped.code,
    exitCode,
    safeSummary: `${mapped.code}: ${mapped.message}`,
    timedOut: mapped.code === "AGENT_CODEX_TIMEOUT",
  };
}

function getCodexStatus() {
  try {
    const entrypoint = resolveCodexEntrypoint();
    const result = spawnSync(process.execPath, [entrypoint, "--version"], {
      encoding: "utf8",
      env: createSafeChildEnv(),
      shell: false,
      timeout: CODEX_STATUS_TIMEOUT_MS,
      windowsHide: true,
    });

    if (result.error) {
      const mapped = mapCodexError(result.error);

      return {
        available: false,
        code: mapped.code,
        mode: "node-entrypoint",
        version: null,
      };
    }

    if (result.status !== 0) {
      return {
        available: false,
        code: "AGENT_CODEX_NOT_EXECUTABLE",
        mode: "node-entrypoint",
        version: null,
      };
    }

    return {
      available: true,
      mode: "node-entrypoint",
      version: redactText(result.stdout || result.stderr || "", 120).trim(),
    };
  } catch (error) {
    const mapped = mapCodexError(error);

    return {
      available: false,
      code: mapped.code,
      mode: "node-entrypoint",
      version: null,
    };
  }
}

async function buildCodexTask({ repoRoot, taskText }) {
  const status = await getRepositoryStatus();
  const safeContext = redactObject({
    branch: status.branch,
    dirty: status.dirty,
    repoRoot,
    task: taskText,
  });

  return [
    "You are Codex running inside BLACK FLASH ORBIT Agent Bridge.",
    "Only edit this repository. Do not read .env files. Do not run destructive git operations. Do not commit, push, merge, or tag.",
    `Safe context: ${JSON.stringify(safeContext)}`,
    "Task:",
    taskText,
  ].join("\n\n");
}

async function runCodexRepairJob({ repoRoot, taskText }) {
  const startedAt = Date.now();
  const safeTask = normalizeTaskText(taskText);
  const prompt = await buildCodexTask({ repoRoot, taskText: safeTask });
  let entrypoint;

  try {
    entrypoint = resolveCodexEntrypoint();
  } catch (error) {
    return buildCodexFailureResult({ error, startedAt });
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint, prompt], {
      cwd: repoRoot,
      env: createSafeChildEnv(repoRoot),
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, CODEX_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"));
    });
    child.on("error", async (error) => {
      clearTimeout(timer);
      const mapped = buildCodexFailureResult({ error, startedAt });

      resolve({
        changedFiles: await getChangedFiles().catch(() => []),
        durationMs: mapped.durationMs,
        errorCode: mapped.errorCode,
        exitCode: mapped.exitCode,
        safeSummary: mapped.safeSummary,
        timedOut: mapped.timedOut,
      });
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      resolve({
        changedFiles: await getChangedFiles().catch(() => []),
        durationMs: Date.now() - startedAt,
        errorCode: timedOut ? "AGENT_CODEX_TIMEOUT" : null,
        exitCode: timedOut ? 124 : code,
        safeSummary: summarizeOutput({
          exitCode: timedOut ? 124 : code,
          stderr,
          stdout,
          timedOut,
        }),
        timedOut,
      });
    });
  });
}

module.exports = {
  buildCodexTask,
  getCodexStatus,
  resolveCodexEntrypoint,
  runCodexRepairJob,
  validateCodexEntrypoint,
};
