const WORKFLOW_DEFINITIONS = {
  ai_operational_check: {
<<<<<<< HEAD
    id: "ai_operational_check",
    name: "AI Operational Check",
    description:
      "Validate workflow persistence, require human approval, then call the existing AI Router.",
=======
    description:
      "Validate workflow persistence, require human approval, then call the existing AI Router.",
    id: "ai_operational_check",
    name: "AI Operational Check",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
    sensitive: true,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
<<<<<<< HEAD
        tool: "internal.validate",
        requiresApproval: false,
        timeoutMs: 5000,
=======
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.validate",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
      },
      {
        id: "human_approval",
        name: "Human approval",
<<<<<<< HEAD
        tool: "approval.human",
        requiresApproval: true,
        timeoutMs: 0,
=======
        requiresApproval: true,
        timeoutMs: 0,
        tool: "approval.human",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
      },
      {
        id: "ai_router_check",
        name: "AI Router check",
<<<<<<< HEAD
        tool: "ai.router",
        requiresApproval: true,
        timeoutMs: 30000,
=======
        requiresApproval: true,
        timeoutMs: 30000,
        tool: "ai.router",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
      },
      {
        id: "persist_result",
        name: "Persist result",
<<<<<<< HEAD
        tool: "internal.persist",
        requiresApproval: false,
        timeoutMs: 5000,
=======
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.persist",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
      },
    ],
  },
  telemetry_sync: {
<<<<<<< HEAD
    id: "telemetry_sync",
    name: "Telemetry Sync",
    description: "Record a safe workflow telemetry checkpoint.",
=======
    description: "Record a safe workflow telemetry checkpoint.",
    id: "telemetry_sync",
    name: "Telemetry Sync",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
    sensitive: false,
    steps: [
      {
        id: "validate_request",
        name: "Validate request",
<<<<<<< HEAD
        tool: "internal.validate",
        requiresApproval: false,
        timeoutMs: 5000,
=======
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.validate",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
      },
      {
        id: "persist_result",
        name: "Persist result",
<<<<<<< HEAD
        tool: "internal.persist",
        requiresApproval: false,
        timeoutMs: 5000,
=======
        requiresApproval: false,
        timeoutMs: 5000,
        tool: "internal.persist",
>>>>>>> 0a5482c (feat: add reusable workflow templates)
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

<<<<<<< HEAD
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
=======
function cloneDefinition(definition) {
  return {
    description: definition.description,
    id: definition.id,
    name: definition.name,
    sensitive: Boolean(definition.sensitive),
    steps: definition.steps.map((step) => ({ ...step })),
  };
}

function getWorkflowDefinitions() {
  return Object.values(WORKFLOW_DEFINITIONS).map(cloneDefinition);
}

function getWorkflowDefinition(definitionId) {
  const definition = WORKFLOW_DEFINITIONS[String(definitionId || "").trim()];

  return definition ? cloneDefinition(definition) : null;
>>>>>>> 0a5482c (feat: add reusable workflow templates)
}

function assertAllowedWorkflowDefinition(definition) {
  if (!definition) {
    const error = new Error("Workflow definition tidak ditemukan.");
<<<<<<< HEAD
    error.statusCode = 404;
    error.code = "WORKFLOW_DEFINITION_NOT_FOUND";
=======
    error.code = "WORKFLOW_DEFINITION_NOT_FOUND";
    error.statusCode = 404;
>>>>>>> 0a5482c (feat: add reusable workflow templates)
    throw error;
  }

  const disallowedStep = definition.steps.find(
    (step) => !ALLOWED_WORKFLOW_TOOLS.has(step.tool),
  );

  if (disallowedStep) {
    const error = new Error("Workflow definition memakai tool yang tidak diizinkan.");
<<<<<<< HEAD
    error.statusCode = 500;
    error.code = "WORKFLOW_TOOL_NOT_ALLOWED";
=======
    error.code = "WORKFLOW_TOOL_NOT_ALLOWED";
    error.statusCode = 500;
>>>>>>> 0a5482c (feat: add reusable workflow templates)
    throw error;
  }
}

module.exports = {
  ALLOWED_WORKFLOW_TOOLS,
  assertAllowedWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowDefinitions,
};
