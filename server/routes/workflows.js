const express = require("express");
const { createRequestId } = require("../services/observability/logger");
const { requireAuth } = require("../middleware/requireAuth");
const {
  approveWorkflowRun,
  cancelWorkflowRun,
  createWorkflowRun,
} = require("../services/workflows/workflowEngine");
const {
  getWorkflowDefinitions,
} = require("../services/workflows/workflowDefinitions");
const {
  getRun,
  listRuns,
} = require("../services/workflows/workflowRepository");

const router = express.Router();

function getOwnerId(req) {
  return req.userId || req.user?.id || null;
}

function sendWorkflowError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  return res.status(safeStatus).json({
    success: false,
    code: error?.code || "WORKFLOW_ERROR",
    message:
      safeStatus >= 500
        ? "Workflow request gagal."
        : error?.message || "Workflow request gagal.",
  });
}

router.use(requireAuth);

router.get("/definitions", (req, res) => {
  res.json({
    success: true,
    data: getWorkflowDefinitions(),
  });
});

router.get("/runs", async (req, res) => {
  try {
    const runs = await listRuns({
      limit: req.query?.limit,
      ownerId: getOwnerId(req),
    });

    return res.json({
      success: true,
      data: runs,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs", async (req, res) => {
  try {
    const run = await createWorkflowRun({
      definitionId: req.body?.definitionId,
      input: req.body?.input,
      ownerId: getOwnerId(req),
      requestId: createRequestId(req),
    });

    return res.status(201).json({
      success: true,
      data: run,
      message: "Workflow run created.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.get("/runs/:id", async (req, res) => {
  try {
    const run = await getRun({
      ownerId: getOwnerId(req),
      runId: req.params.id,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "WORKFLOW_RUN_NOT_FOUND",
        message: "Workflow run tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs/:id/approve", async (req, res) => {
  try {
    const run = await approveWorkflowRun({
      approvedBy: getOwnerId(req),
      ownerId: getOwnerId(req),
      requestId: createRequestId(req),
      runId: req.params.id,
    });

    return res.json({
      success: true,
      data: run,
      message: "Workflow approved and executed.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

router.post("/runs/:id/cancel", async (req, res) => {
  try {
    const run = await cancelWorkflowRun({
      ownerId: getOwnerId(req),
      runId: req.params.id,
    });

    return res.json({
      success: true,
      data: run,
      message: "Workflow cancelled.",
    });
  } catch (error) {
    return sendWorkflowError(res, error);
  }
});

module.exports = router;
