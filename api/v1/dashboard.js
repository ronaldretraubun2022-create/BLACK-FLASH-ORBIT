const SERVICE_NAME = "BLACK FLASH ORBIT API";
const API_VERSION = "v1";

const projects = [
  {
    name: "BLACK-FLASH-ORBIT",
    type: "platform",
    status: "ACTIVE",
    score: 96,
    lastScan: "live",
  },
  {
    name: "ORBIT-WEB",
    type: "frontend",
    status: "SYNCED",
    score: 94,
    lastScan: "live",
  },
  {
    name: "ORBIT-AI-WORKSPACE",
    type: "ai-workspace",
    status: "READY",
    score: 92,
    lastScan: "live",
  },
  {
    name: "ORBIT-SECURITY",
    type: "security",
    status: "PROTECTED",
    score: 94,
    lastScan: "live",
  },
];

const automationEngines = {
  auditEngine: {
    name: "Project Audit",
    status: "ONLINE",
    description:
      "Inspect workspace structure, runtime health, and project readiness.",
  },
  fixEngine: {
    name: "Code Repair",
    status: "READY",
    description:
      "Prepare focused fixes for detected issues and build failures.",
  },
  workspaceScanner: {
    name: "Repository Scan",
    status: "ACTIVE",
    description:
      "Track project modules and surface operational workspace signals.",
  },
  deployEngine: {
    name: "Deploy Pipeline",
    status: "READY",
    description: "Prepare validated production builds for controlled release.",
  },
};

function getTimestamp() {
  return new Date().toISOString();
}

function getEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function getMemory() {
  const memory = process.memoryUsage();

  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
  };
}

function getOrbitHealth() {
  return {
    success: true,
    service: SERVICE_NAME,
    status: "healthy",
    module: "health",
    uptime: process.uptime(),
    timestamp: getTimestamp(),
  };
}

function getOrbitMetrics() {
  return {
    projects: projects.length,
    reports: 0,
    uptime: process.uptime(),
    memory: getMemory(),
    timestamp: getTimestamp(),
  };
}

function getOrbitProjects() {
  return projects.map((project) => ({ ...project }));
}

function getOrbitActivity() {
  const timestamp = getTimestamp();

  return [
    {
      type: "system",
      message: "Dashboard telemetry Vercel API online.",
      time: timestamp,
    },
    {
      type: "ai",
      message: "ORBIT AI Workspace route tetap tersedia.",
      time: timestamp,
    },
    {
      type: "security",
      message: "Security Center status protected.",
      time: timestamp,
    },
  ];
}

function getOrbitSecurity() {
  return {
    securityScore: 94,
    helmet: "PROTECTED",
    cors: "PROTECTED",
    rateLimit: "ACTIVE",
    lastAudit: "live",
    issues: [],
  };
}

function getOrbitSystem() {
  return {
    success: true,
    status: "online",
    module: "system",
    apiVersion: API_VERSION,
    environment: getEnvironment(),
    runtime: process.env.VERCEL ? "vercel" : "node",
    timestamp: getTimestamp(),
  };
}

function getOrbitAutomation() {
  return automationEngines;
}

function createDashboardData() {
  return {
    activity: getOrbitActivity(),
    automation: getOrbitAutomation(),
    health: getOrbitHealth(),
    metrics: getOrbitMetrics(),
    projects: getOrbitProjects(),
    security: getOrbitSecurity(),
    system: getOrbitSystem(),
  };
}

function createDashboardResponse() {
  const data = createDashboardData();

  return {
    success: true,
    status: "ready",
    module: "dashboard",
    message: "Dashboard telemetry ready.",
    data,
    metrics: data.metrics,
    timestamp: getTimestamp(),
  };
}

function sendJson(res, body, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return sendJson(
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  return sendJson(res, createDashboardResponse());
}

module.exports = handler;
module.exports.createDashboardData = createDashboardData;
module.exports.createDashboardResponse = createDashboardResponse;
module.exports.getOrbitActivity = getOrbitActivity;
module.exports.getOrbitAutomation = getOrbitAutomation;
module.exports.getOrbitHealth = getOrbitHealth;
module.exports.getOrbitMetrics = getOrbitMetrics;
module.exports.getOrbitProjects = getOrbitProjects;
module.exports.getOrbitSecurity = getOrbitSecurity;
module.exports.getOrbitSystem = getOrbitSystem;
module.exports.sendJson = sendJson;
