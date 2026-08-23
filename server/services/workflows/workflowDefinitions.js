const WORKFLOW_DEFINITIONS = {
  ai_operational_check: {
    id: "ai_operational_check",
    name: "AI Operational Check",
    description:
      "Validate workflow persistence, require human approval, then call the existing AI Router.",
    sensitive: true,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
        tool: "internal.validate",
        requiresApproval: false,
        timeoutMs: 5000,
      },
      {
        id: "human_approval",
        name: "Human approval",
        tool: "approval.human",
        requiresApproval: true,
        timeoutMs: 0,
      },
      {
        id: "ai_router_check",
        name: "AI Router check",
        tool: "ai.router",
        requiresApproval: true,
        timeoutMs: 30000,
      },
      {
        id: "persist_result",
        name: "Persist result",
        tool: "internal.persist",
        requiresApproval: false,
        timeoutMs: 5000,
      },
    ],
  },
  telemetry_sync: {
    id: "telemetry_sync",
    name: "Telemetry Sync",
    description: "Record a safe workflow telemetry checkpoint.",
    sensitive: false,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
        tool: "internal.validate",
        requiresApproval: false,
        timeoutMs: 5000,
      },
      {
        id: "persist_result",
        name: "Persist result",
        tool: "internal.persist",
        requiresApproval: false,
        timeoutMs: 5000,
      },
    ],
  },
};

const ALLOWED_WORKFLOW_TOOLS = new Set([
  "ai.router",
  "approval.human",
  "internal.persist",
  "internal.validate",
]);

function getWorkflowDefinitions() {
  return Object.values(WORKFLOW_DEFINITIONS).map((definition) => ({
    description: definition.description,
    id: definition.id,
    name: definition.name,
    sensitive: definition.sensitive,
    steps: definition.steps.map((step) => ({ ...step })),
  }));
}

function getWorkflowDefinition(definitionId) {
  return WORKFLOW_DEFINITIONS[String(definitionId || "").trim()] || null;
}

function assertAllowedWorkflowDefinition(definition) {
  if (!definition) {
    const error = new Error("Workflow definition tidak ditemukan.");
    error.statusCode = 404;
    error.code = "WORKFLOW_DEFINITION_NOT_FOUND";
    throw error;
  }

  const disallowedStep = definition.steps.find(
    (step) => !ALLOWED_WORKFLOW_TOOLS.has(step.tool),
  );

  if (disallowedStep) {
    const error = new Error("Workflow definition memakai tool yang tidak diizinkan.");
    error.statusCode = 500;
    error.code = "WORKFLOW_TOOL_NOT_ALLOWED";
    throw error;
  }
}

module.exports = {
  ALLOWED_WORKFLOW_TOOLS,
  assertAllowedWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowDefinitions,
};
