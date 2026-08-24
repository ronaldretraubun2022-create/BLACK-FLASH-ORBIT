const { getSupabaseAdmin } = require("../supabaseAdmin");
const { runAllowedCommand } = require("./commandAllowlist");
const { getCodexStatus, runCodexRepairJob } = require("./codexBridge");
const { recordAgentAudit } = require("./agentAudit");
const {
  getChangedFiles,
  getConfiguredRepoRoot,
  getRepositoryStatus,
  getSafeDiffSummary,
} = require("./repositoryInspector");
const { getAgentBridgeState, isAgentBridgeEnabled } = require("./agentConfig");
const { redactObject, redactText } = require("./redaction");

const JOB_COLUMNS = "id, owner_id, title, status, created_at, updated_at";
const RUN_COLUMNS =
  "id, owner_id, job_id, stage, status, exit_code, started_at, completed_at, safe_summary, changed_files";
const VALIDATION_COMMANDS = [
  "npm run lint",
  "npm run test:security",
  "npm run test",
  "npm run build",
  "npm audit --omit=dev",
  "git diff --check",
];

function createAgentError(message, statusCode = 500, code = "AGENT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw createAgentError("Agent persistence belum dikonfigurasi.", 503, "AGENT_PERSISTENCE_NOT_CONFIGURED");
  }

  return client;
}

function normalizeDbError(error, code = "AGENT_PERSISTENCE_FAILED") {
  const text = String(error?.message || error?.details || error?.code || "").toLowerCase();

  if (text.includes("does not exist") || text.includes("schema")) {
    return createAgentError("Agent schema missing.", 503, "AGENT_SCHEMA_MISSING");
  }

  return createAgentError("Agent persistence gagal.", 500, code);
}

function mapPersistenceError(error) {
  const agentError =
    error?.code && /^AGENT_[A-Z0-9_]+$/.test(error.code)
      ? error
      : normalizeDbError(error, "AGENT_STATUS_FAILED");

  return {
    available: false,
    code: agentError.code || "AGENT_PERSISTENCE_FAILED",
    message: agentError.message || "Agent persistence gagal.",
    status: "unavailable",
  };
}

function buildEmptyMetrics(repoStatus, overrides = {}) {
  return {
    currentRepoBranch: repoStatus.branch,
    jobsFailed: 0,
    jobsQueued: 0,
    jobsRunning: 0,
    jobsSucceeded: 0,
    lastRun: null,
    lastValidation: null,
    workingTree: repoStatus.status,
    ...overrides,
  };
}

function mapJob(row) {
  return {
    createdAt: row.created_at,
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapRun(row) {
  return {
    changedFiles: Array.isArray(row.changed_files) ? row.changed_files : [],
    completedAt: row.completed_at || null,
    exitCode: row.exit_code,
    id: row.id,
    jobId: row.job_id,
    ownerId: row.owner_id,
    safeSummary: row.safe_summary || "",
    stage: row.stage,
    startedAt: row.started_at,
    status: row.status,
  };
}

function normalizeTitle(value) {
  const title = redactText(value, 160).replace(/\s+/g, " ").trim();

  return title || "ORBIT Agent Job";
}

function buildJobTitle(input = {}) {
  return normalizeTitle(input.title || input.task || input.taskText || input.task_text);
}

async function updateJobStatus({ jobId, ownerId, status }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("id", jobId)
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_JOB_UPDATE_FAILED");
  if (!data) throw createAgentError("Agent job tidak ditemukan.", 404, "AGENT_JOB_NOT_FOUND");

  return mapJob(data);
}

async function createRun({ changedFiles = [], exitCode = null, jobId, ownerId, safeSummary = "", stage, status }) {
  const client = getClient();
  const completedAt = ["succeeded", "failed", "blocked"].includes(status)
    ? new Date().toISOString()
    : null;
  const { data, error } = await client
    .from("orbit_agent_runs")
    .insert({
      changed_files: redactObject(changedFiles).slice(0, 100),
      completed_at: completedAt,
      exit_code: exitCode,
      job_id: jobId,
      owner_id: ownerId,
      safe_summary: redactText(safeSummary, 10000),
      stage,
      status,
      started_at: new Date().toISOString(),
    })
    .select(RUN_COLUMNS)
    .single();

  if (error) throw normalizeDbError(error, "AGENT_RUN_CREATE_FAILED");

  return mapRun(data);
}

async function listRunsForJob({ jobId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_runs")
    .select(RUN_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("job_id", jobId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) throw normalizeDbError(error, "AGENT_RUN_LIST_FAILED");

  return (data || []).map(mapRun);
}

async function getAgentStatus({ ownerId }) {
  const agentBridge = getAgentBridgeState();
  const codex = getCodexStatus();
  const disabledRepoStatus = {
    branch: "disabled",
    dirty: false,
    repoRootLabel: "BLACK-FLASH-ORBIT",
    status: "disabled",
    statusSummary: agentBridge.reason,
  };

  if (!isAgentBridgeEnabled()) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(disabledRepoStatus),
      persistence: {
        available: false,
        code: "AGENT_BRIDGE_DISABLED",
        message: agentBridge.reason,
        status: "disabled",
      },
      repository: disabledRepoStatus,
    };
  }

  const repoStatus = await getRepositoryStatus();
  let client;

  try {
    client = getClient();
  } catch (error) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(repoStatus),
      persistence: mapPersistenceError(error),
      repository: repoStatus,
    };
  }

  const [jobsQueued, jobsRunning, jobsSucceeded, jobsFailed, lastRun, lastValidation] =
    await Promise.all([
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "queued"),
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).in("status", ["diagnosing", "running", "validating"]),
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).in("status", ["succeeded", "approved"]),
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "failed"),
      client.from("orbit_agent_runs").select(RUN_COLUMNS).eq("owner_id", ownerId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("orbit_agent_runs").select(RUN_COLUMNS).eq("owner_id", ownerId).eq("stage", "validate").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
  const firstError =
    jobsQueued.error ||
    jobsRunning.error ||
    jobsSucceeded.error ||
    jobsFailed.error ||
    lastRun.error ||
    lastValidation.error;

  if (firstError) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(repoStatus),
      persistence: mapPersistenceError(firstError),
      repository: repoStatus,
    };
  }

  return {
    agentBridge,
    codex,
    metrics: {
      currentRepoBranch: repoStatus.branch,
      jobsFailed: Number(jobsFailed.count || 0),
      jobsQueued: Number(jobsQueued.count || 0),
      jobsRunning: Number(jobsRunning.count || 0),
      jobsSucceeded: Number(jobsSucceeded.count || 0),
      lastRun: lastRun.data ? mapRun(lastRun.data) : null,
      lastValidation: lastValidation.data ? mapRun(lastValidation.data) : null,
      workingTree: repoStatus.status,
    },
    persistence: {
      available: true,
      code: null,
      message: "Agent persistence ready.",
      status: "ready",
    },
    repository: repoStatus,
  };
}

async function createAgentJob({ input = {}, ownerId }) {
  const title = buildJobTitle(input);
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .insert({
      owner_id: ownerId,
      status: "queued",
      title,
    })
    .select(JOB_COLUMNS)
    .single();

  if (error) throw normalizeDbError(error, "AGENT_JOB_CREATE_FAILED");

  const job = mapJob(data);

  await recordAgentAudit({
    eventType: "job_created",
    jobId: job.id,
    metadata: { title },
    ownerId,
  });

  return job;
}

async function listAgentJobs({ ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .select(JOB_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw normalizeDbError(error, "AGENT_JOB_LIST_FAILED");

  return (data || []).map(mapJob);
}

async function getAgentJob({ jobId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .select(JOB_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_JOB_LOOKUP_FAILED");
  if (!data) throw createAgentError("Agent job tidak ditemukan.", 404, "AGENT_JOB_NOT_FOUND");

  return {
    ...mapJob(data),
    runs: await listRunsForJob({ jobId, ownerId }),
  };
}

async function runAgentDiagnostics({ jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();

  await updateJobStatus({ jobId, ownerId, status: "diagnosing" });

  const commands = ["git branch --show-current", "git status", "git diff --check", "git log --oneline"];
  const results = [];

  for (const command of commands) {
    results.push(await runAllowedCommand({ command, repoRoot, timeoutMs: 30000 }));
  }

  const failed = results.some((result) => Number(result.exitCode) !== 0);
  const changedFiles = await getChangedFiles();
  const run = await createRun({
    changedFiles,
    exitCode: failed ? 1 : 0,
    jobId,
    ownerId,
    safeSummary: results.map((result) => `${result.commandId}\n${result.safeSummary}`).join("\n\n"),
    stage: "diagnose",
    status: failed ? "failed" : "succeeded",
  });

  await updateJobStatus({ jobId, ownerId, status: failed ? "failed" : "diagnosed" });
  await recordAgentAudit({
    eventType: "diagnostics_completed",
    jobId,
    metadata: { changedFileCount: changedFiles.length, failed },
    ownerId,
  });

  return run;
}

async function runAgentRepair({ input = {}, jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();
  const job = await getAgentJob({ jobId, ownerId });
  const taskText = input.taskText || input.task || job.title;
  const codex = getCodexStatus();

  if (!codex.available) {
    throw createAgentError(
      "Codex CLI tidak tersedia untuk Prepare Repair.",
      503,
      codex.code || "AGENT_CODEX_NOT_FOUND",
    );
  }

  await updateJobStatus({ jobId, ownerId, status: "running" });

  const result = await runCodexRepairJob({ repoRoot, taskText });
  const succeeded = Number(result.exitCode) === 0;
  const run = await createRun({
    changedFiles: result.changedFiles,
    exitCode: result.exitCode,
    jobId,
    ownerId,
    safeSummary: result.safeSummary,
    stage: "codex_repair",
    status: succeeded ? "succeeded" : "failed",
  });

  await updateJobStatus({
    jobId,
    ownerId,
    status: succeeded ? "awaiting_approval" : "failed",
  });
  await recordAgentAudit({
    eventType: "codex_repair_completed",
    jobId,
    metadata: {
      changedFileCount: result.changedFiles.length,
      exitCode: result.exitCode,
      timedOut: Boolean(result.timedOut),
    },
    ownerId,
  });

  return run;
}

async function validateAgentJob({ jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();

  await updateJobStatus({ jobId, ownerId, status: "validating" });

  const results = [];

  for (const command of VALIDATION_COMMANDS) {
    results.push(await runAllowedCommand({ command, repoRoot, timeoutMs: 10 * 60 * 1000 }));
  }

  const failed = results.some((result) => Number(result.exitCode) !== 0);
  const changedFiles = await getChangedFiles();
  const run = await createRun({
    changedFiles,
    exitCode: failed ? 1 : 0,
    jobId,
    ownerId,
    safeSummary: results.map((result) => `${result.commandId}\n${result.safeSummary}`).join("\n\n"),
    stage: "validate",
    status: failed ? "failed" : "succeeded",
  });

  await updateJobStatus({ jobId, ownerId, status: failed ? "failed" : "awaiting_approval" });
  await recordAgentAudit({
    eventType: "validation_completed",
    jobId,
    metadata: { changedFileCount: changedFiles.length, failed },
    ownerId,
  });

  return run;
}

async function approveAgentJob({ jobId, ownerId }) {
  const job = await updateJobStatus({ jobId, ownerId, status: "approved" });

  await recordAgentAudit({
    eventType: "job_approved",
    jobId,
    metadata: { commitCreated: false, pushCreated: false, tagCreated: false },
    ownerId,
  });

  return job;
}

async function rejectAgentJob({ jobId, ownerId }) {
  const job = await updateJobStatus({ jobId, ownerId, status: "rejected" });

  await recordAgentAudit({
    eventType: "job_rejected",
    jobId,
    metadata: { destructiveCleanup: false },
    ownerId,
  });

  return job;
}

async function getAgentJobDiff({ jobId, ownerId }) {
  await getAgentJob({ jobId, ownerId });

  return getSafeDiffSummary();
}

module.exports = {
  approveAgentJob,
  createAgentJob,
  getAgentJob,
  getAgentJobDiff,
  getAgentStatus,
  listAgentJobs,
  rejectAgentJob,
  runAgentDiagnostics,
  runAgentRepair,
  validateAgentJob,
};
