const crypto = require("node:crypto");

const { getHealthSnapshot } = require("./healthService");
const { getRecentRuntimeErrors, sanitizeScalar } = require("./logger");

const AI_CHAT_EVENT_LIMIT = 30;
const aiChatEvents = [];

function hashValue(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return null;

  return crypto.createHash("sha256").update(cleanValue).digest("hex").slice(0, 12);
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function recordAiChatTelemetry(event = {}) {
  const userId = event.user?.id || event.userId || null;
  const providerLatencyMs = toNumber(event.providerLatencyMs);
  const durationMs = toNumber(event.durationMs);

  aiChatEvents.unshift({
    authenticated: Boolean(userId),
    code: sanitizeScalar(event.code || null, 120),
    durationMs,
    model: sanitizeScalar(event.model || null, 160),
    provider: sanitizeScalar(event.provider || "openrouter", 80),
    providerLatencyMs,
    providerReached: Boolean(event.providerReached),
    stage: sanitizeScalar(event.stage || "unknown", 80),
    status: sanitizeScalar(event.status || "unknown", 40),
    timestamp: new Date().toISOString(),
    userHash: hashValue(userId),
  });

  aiChatEvents.splice(AI_CHAT_EVENT_LIMIT);
}

function getAiChatObservability() {
  const total = aiChatEvents.length;
  const successes = aiChatEvents.filter((event) => event.status === "success").length;
  const failures = aiChatEvents.filter((event) => event.status === "failed").length;
  const providerReached = aiChatEvents.filter((event) => event.providerReached).length;
  const providerLatencies = aiChatEvents
    .map((event) => event.providerLatencyMs)
    .filter((value) => Number.isFinite(value));
  const averageProviderLatencyMs = providerLatencies.length
    ? Math.round(
        providerLatencies.reduce((totalMs, value) => totalMs + value, 0) /
          providerLatencies.length,
      )
    : null;
  const latest = aiChatEvents[0] || null;

  return {
    averageProviderLatencyMs,
    failures,
    latest,
    providerReached,
    recent: aiChatEvents.slice(0, 5).map((event) => ({ ...event })),
    successes,
    total,
  };
}

function getModuleHealth(health = getHealthSnapshot()) {
  const dependencies = health.dependencies || {};

  return [
    {
      module: "runtime",
      status: health.status || "unknown",
    },
    {
      module: "supabase",
      status: dependencies.supabase?.status || "unknown",
    },
    {
      module: "ai",
      provider: dependencies.ai?.provider || "openrouter",
      status: dependencies.ai?.status || "unknown",
    },
    {
      module: "knowledge",
      status: dependencies.knowledge?.status || "unknown",
    },
    {
      module: "logger",
      status: "ready",
    },
  ];
}

function getDeploymentMetadata(health = getHealthSnapshot()) {
  return {
    branch:
      sanitizeScalar(
        process.env.VERCEL_GIT_COMMIT_REF ||
          process.env.GIT_BRANCH ||
          process.env.BRANCH ||
          "local",
        120,
      ) || "local",
    commit:
      sanitizeScalar(
        process.env.VERCEL_GIT_COMMIT_SHA
          ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
          : "",
        24,
      ) || null,
    environment: health.environment || "development",
    region: sanitizeScalar(process.env.VERCEL_REGION || "local", 80) || "local",
    runtime: health.runtime || "node",
  };
}

function getAuthSessionVisibility(user) {
  return {
    authenticated: Boolean(user?.id),
    provider: "supabase",
    session: user?.id ? "validated" : "not_present",
    userHash: hashValue(user?.id),
  };
}

function getOperationalIntelligence({ user } = {}) {
  const health = getHealthSnapshot();

  return {
    aiChat: getAiChatObservability(),
    authSession: getAuthSessionVisibility(user),
    deployment: getDeploymentMetadata(health),
    moduleHealth: getModuleHealth(health),
    recentRuntimeErrors: getRecentRuntimeErrors(5),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getOperationalIntelligence,
  recordAiChatTelemetry,
};
