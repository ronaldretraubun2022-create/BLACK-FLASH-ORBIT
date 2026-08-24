const { spawn } = require("node:child_process");
const { getChangedFiles, getRepositoryStatus } = require("./repositoryInspector");
const { createSafeChildEnv } = require("./commandAllowlist");
const { redactObject, redactText, summarizeOutput } = require("./redaction");

const CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CODEX_OUTPUT_CHARS = 50000;
const CODEX_EXECUTABLE = "codex";

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
  const safeTask = normalizeTaskText(taskText);
  const prompt = await buildCodexTask({ repoRoot, taskText: safeTask });

  return new Promise((resolve) => {
    const child = spawn(CODEX_EXECUTABLE, [prompt], {
      cwd: repoRoot,
      env: createSafeChildEnv(repoRoot),
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const startedAt = Date.now();
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
      resolve({
        changedFiles: await getChangedFiles().catch(() => []),
        durationMs: Date.now() - startedAt,
        exitCode: 127,
        safeSummary: summarizeOutput({
          exitCode: 127,
          stderr: error.message,
          stdout,
          timedOut,
        }),
        timedOut,
      });
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      resolve({
        changedFiles: await getChangedFiles().catch(() => []),
        durationMs: Date.now() - startedAt,
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
  runCodexRepairJob,
};
