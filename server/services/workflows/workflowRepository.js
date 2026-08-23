const { getSupabaseAdmin, isSupabaseServiceConfigured } = require("../supabaseAdmin");
const { redactValue, sanitizeScalar } = require("../observability/logger");

const RUN_COLUMNS =
  "id, owner_id, definition_id, status, metadata, error_code, error_message, created_at, updated_at, started_at, completed_at";
const STEP_COLUMNS =
  "id, run_id, owner_id, step_id, status, tool, attempts, metadata, error_code, error_message, started_at, completed_at, created_at, updated_at";
const APPROVAL_COLUMNS =
  "id, run_id, owner_id, step_id, status, approved_by, approved_at, created_at";

function getWorkflowPersistenceStatus() {
  return {
    configured: isSupabaseServiceConfigured(),
    status: isSupabaseServiceConfigured() ? "configured" : "not_configured",
  };
}

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    const error = new Error("Workflow persistence belum dikonfigurasi.");
    error.statusCode = 503;
    error.code = "WORKFLOW_PERSISTENCE_NOT_CONFIGURED";
    throw error;
  }

  return client;
}

function normalizeLimit(value, fallback = 25) {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) return fallback;

  return Math.min(limit, 100);
}

function safeMetadata(metadata = {}) {
  const redacted = redactValue(metadata || {});

  return JSON.parse(JSON.stringify(redacted || {}));
}

function mapRun(row, steps = [], approvals = []) {
  if (!row) return null;

  return {
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    definitionId: row.definition_id,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    id: row.id,
    metadata: row.metadata || {},
    ownerId: row.owner_id,
    startedAt: row.started_at || null,
    status: row.status,
    updatedAt: row.updated_at || null,
    steps: steps.map(mapStep),
    approvals: approvals.map(mapApproval),
  };
}

function mapStep(row) {
  return {
    attempts: Number(row.attempts || 0),
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    id: row.id,
    metadata: row.metadata || {},
    ownerId: row.owner_id,
    runId: row.run_id,
    startedAt: row.started_at || null,
    status: row.status,
    stepId: row.step_id,
    tool: row.tool,
    updatedAt: row.updated_at || null,
  };
}

function mapApproval(row) {
  return {
    approvedAt: row.approved_at || null,
    approvedBy: row.approved_by || null,
    createdAt: row.created_at || null,
    id: row.id,
    ownerId: row.owner_id,
    runId: row.run_id,
    status: row.status,
    stepId: row.step_id,
  };
}

async function assertNoError(result, code = "WORKFLOW_PERSISTENCE_ERROR") {
  if (!result?.error) return result;

  const error = new Error("Workflow persistence gagal.");
  error.statusCode = 503;
  error.code = code;
  error.safeDetails = {
    dbCode: sanitizeScalar(result.error.code, 80),
  };
  throw error;
}

async function createRunWithSteps({ definition, metadata = {}, ownerId }) {
  const client = getClient();
  const startedAt = new Date().toISOString();
  let run = null;
  const runResult = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .insert({
        definition_id: definition.id,
        metadata: safeMetadata(metadata),
        owner_id: ownerId,
        started_at: startedAt,
        status: "queued",
      })
      .select(RUN_COLUMNS)
      .single(),
  );
  run = runResult.data;
  const stepRows = definition.steps.map((step, index) => ({
    attempts: 0,
    metadata: safeMetadata({
      name: step.name,
      order: index + 1,
      requiresApproval: step.requiresApproval,
      timeoutMs: step.timeoutMs,
    }),
    owner_id: ownerId,
    run_id: run.id,
    status: "queued",
    step_id: step.id,
    tool: step.tool,
  }));

  let stepsResult = null;

  try {
    stepsResult = await assertNoError(
      await client
        .from("orbit_workflow_run_steps")
        .insert(stepRows)
        .select(STEP_COLUMNS),
    );
  } catch (error) {
    await client
      .from("orbit_workflow_runs")
      .update({
        completed_at: new Date().toISOString(),
        error_code: sanitizeScalar(error.code, 120),
        error_message: "Workflow persistence gagal.",
        status: "failed",
      })
      .eq("owner_id", ownerId)
      .eq("id", run.id);
    throw error;
  }

  await recordAuditEvent({
    eventType: "run_created",
    metadata: { definitionId: definition.id },
    ownerId,
    runId: run.id,
  });

  return mapRun(run, stepsResult.data || [], []);
}

async function getRun({ ownerId, runId }) {
  const client = getClient();
  const runResult = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .select(RUN_COLUMNS)
      .eq("owner_id", ownerId)
      .eq("id", runId)
      .maybeSingle(),
  );

  if (!runResult.data) return null;

  const [stepsResult, approvalsResult] = await Promise.all([
    assertNoError(
      await client
        .from("orbit_workflow_run_steps")
        .select(STEP_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("run_id", runId)
        .order("created_at", { ascending: true }),
    ),
    assertNoError(
      await client
        .from("orbit_workflow_approvals")
        .select(APPROVAL_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("run_id", runId)
        .order("created_at", { ascending: true }),
    ),
  ]);

  return mapRun(runResult.data, stepsResult.data || [], approvalsResult.data || []);
}

async function listRuns({ limit, ownerId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .select(RUN_COLUMNS)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(normalizeLimit(limit)),
  );

  return (result.data || []).map((row) => mapRun(row));
}

async function updateRun({ completed = false, metadata, ownerId, runId, status, error }) {
  const client = getClient();
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (completed) patch.completed_at = patch.updated_at;
  if (metadata) patch.metadata = safeMetadata(metadata);
  if (error) {
    patch.error_code = sanitizeScalar(error.code, 120);
    patch.error_message = sanitizeScalar(error.message, 500);
  }

  const result = await assertNoError(
    await client
      .from("orbit_workflow_runs")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", runId)
      .select(RUN_COLUMNS)
      .single(),
  );

  return mapRun(result.data);
}

async function updateStep({ attempts, completed = false, metadata, ownerId, runId, status, stepId, error }) {
  const client = getClient();
  const now = new Date().toISOString();
  const patch = {
    status,
    updated_at: now,
  };

  if (Number.isInteger(attempts)) patch.attempts = attempts;
  if (status === "running") patch.started_at = now;
  if (completed) patch.completed_at = now;
  if (metadata) patch.metadata = safeMetadata(metadata);
  if (error) {
    patch.error_code = sanitizeScalar(error.code, 120);
    patch.error_message = sanitizeScalar(error.message, 500);
  }

  const result = await assertNoError(
    await client
      .from("orbit_workflow_run_steps")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("run_id", runId)
      .eq("step_id", stepId)
      .select(STEP_COLUMNS)
      .single(),
  );

  return mapStep(result.data);
}

async function recordApproval({ approvedBy, ownerId, runId, stepId }) {
  const client = getClient();
  const result = await assertNoError(
    await client
      .from("orbit_workflow_approvals")
      .insert({
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        owner_id: ownerId,
        run_id: runId,
        status: "approved",
        step_id: stepId,
      })
      .select(APPROVAL_COLUMNS)
      .single(),
  );

  await recordAuditEvent({
    eventType: "approval_recorded",
    metadata: { stepId },
    ownerId,
    runId,
  });

  return mapApproval(result.data);
}

async function recordAuditEvent({ eventType, metadata = {}, ownerId, runId }) {
  const client = getClient();

  await assertNoError(
    await client.from("orbit_workflow_audit_events").insert({
      event_type: eventType,
      metadata: safeMetadata(metadata),
      owner_id: ownerId,
      run_id: runId,
    }),
  );
}

async function checkWorkflowPersistence() {
  if (!isSupabaseServiceConfigured()) {
    return {
      configured: false,
      status: "not_configured",
    };
  }

  try {
    const client = getClient();
    const result = await client
      .from("orbit_workflow_runs")
      .select("id")
      .limit(1);

    if (result.error) {
      return {
        configured: true,
        status: "unavailable",
        code: sanitizeScalar(result.error.code, 80),
      };
    }

    return {
      configured: true,
      status: "ready",
    };
  } catch (error) {
    return {
      configured: true,
      status: "unavailable",
      code: sanitizeScalar(error.code || error.name, 80),
    };
  }
}

module.exports = {
  checkWorkflowPersistence,
  createRunWithSteps,
  getRun,
  getWorkflowPersistenceStatus,
  listRuns,
  recordApproval,
  recordAuditEvent,
  updateRun,
  updateStep,
};
