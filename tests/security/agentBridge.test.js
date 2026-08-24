const assert = require("node:assert");
const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  rootDir,
  "supabase/migrations/20260824060000_orbit_agent_bridge_v1_3.sql",
);
const routePath = path.join(rootDir, "server/routes/agent.js");
const serverPath = path.join(rootDir, "server/index.js");
const configPath = path.join(rootDir, "server/services/agent/agentConfig.js");
const allowlistPath = path.join(rootDir, "server/services/agent/commandAllowlist.js");
const codexBridgePath = path.join(rootDir, "server/services/agent/codexBridge.js");
const repositoryInspectorPath = path.join(
  rootDir,
  "server/services/agent/repositoryInspector.js",
);
const jobServicePath = path.join(rootDir, "server/services/agent/agentJobService.js");
const redactionPath = path.join(rootDir, "server/services/agent/redaction.js");
const pagePath = path.join(rootDir, "apps/web/src/pages/AgentBridge.jsx");
const apiPath = path.join(rootDir, "apps/web/src/services/api.js");
const appPath = path.join(rootDir, "apps/web/src/App.jsx");
const sidebarPath = path.join(rootDir, "apps/web/src/components/CommandCenterSidebar.jsx");
const runnerPath = path.join(rootDir, "scripts/orbit-agent-runner.mjs");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("agent bridge migration creates owner-scoped RLS tables", () => {
  const sql = read(migrationPath);

  for (const table of ["orbit_agent_jobs", "orbit_agent_runs", "orbit_agent_audit"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /for delete\s+using \(false\)/);
  assert.match(sql, /safe_summary text not null default ''/);
  assert.match(sql, /changed_files jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /safe_metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /safe_metadata::text !~\*/);
  assert.match(sql, /create or replace function public\.set_orbit_agent_updated_at\(\)/);
  assert.match(sql, /execute function public\.set_orbit_agent_updated_at\(\)/);
  assert.doesNotMatch(sql, /set_orbit_intelligence_updated_at/);
});

test("agent bridge routes require auth and never accept client owner id", () => {
  const route = read(routePath);
  const server = read(serverPath);

  assert.match(route, /router\.use\(requireAuth\)/);
  assert.match(route, /rateLimit\(\{/);
  assert.match(route, /router\.get\(\s*["']\/status["']/);
  assert.match(route, /router\.use\(requireAgentBridgeEnabled\)/);
  assert.match(route, /ownerId: getOwnerId\(req\)/);
  assert.doesNotMatch(route, /ownerId:\s*req\.body/);
  assert.doesNotMatch(route, /ORBIT_CODEX_ENTRYPOINT|codexEntrypoint|entrypoint:\s*req\.body|req\.query\.entrypoint/);
  for (const endpoint of [
    "/status",
    "/jobs",
    "/jobs/:id",
    "/jobs/:id/diagnose",
    "/jobs/:id/run",
    "/jobs/:id/validate",
    "/jobs/:id/approve",
    "/jobs/:id/reject",
    "/jobs/:id/diff",
  ]) {
    assert(route.includes(endpoint), `${endpoint} missing`);
  }
  assert.match(server, /\/api\/v1\/agent/);
});

test("agent bridge is disabled by default unless local server flag is explicit", () => {
  const previous = process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  const { assertAgentBridgeEnabled, getAgentBridgeState, isAgentBridgeEnabled } =
    require("../../server/services/agent/agentConfig");
  const route = read(routePath);
  const service = read(jobServicePath);
  const page = read(pagePath);
  const config = read(configPath);

  delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  assert.strictEqual(isAgentBridgeEnabled(), false);
  assert.strictEqual(getAgentBridgeState().enabled, false);
  assert.throws(() => assertAgentBridgeEnabled(), /dinonaktifkan|disabled/i);

  process.env.ORBIT_AGENT_BRIDGE_ENABLED = "true";
  assert.strictEqual(isAgentBridgeEnabled(), true);
  assert.strictEqual(getAgentBridgeState().enabled, true);

  if (previous === undefined) {
    delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  } else {
    process.env.ORBIT_AGENT_BRIDGE_ENABLED = previous;
  }

  assert.match(config, /ORBIT_AGENT_BRIDGE_ENABLED/);
  assert.match(route, /AGENT_BRIDGE_DISABLED|assertAgentBridgeEnabled/);
  assert.match(service, /getAgentBridgeState/);
  assert.match(service, /status: "disabled"/);
  assert.match(page, /agentBridge/);
  assert.match(page, /Local bridge disabled/);
  assert.match(page, /ORBIT_AGENT_BRIDGE_ENABLED=true/);
});

function createFakeCodexEntrypoint() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-codex-"));
  const entrypoint = path.join(
    root,
    "node_modules",
    "@openai",
    "codex",
    "bin",
    "codex.js",
  );

  fs.mkdirSync(path.dirname(entrypoint), { recursive: true });
  fs.writeFileSync(
    entrypoint,
    [
      "#!/usr/bin/env node",
      "if (process.argv.includes('--version')) {",
      "  console.log('codex-cli 0.149.0');",
      "  process.exit(0);",
      "}",
      "console.log('fake codex repair completed');",
    ].join("\n"),
  );

  return { entrypoint, root };
}

test("codex resolver uses verified node entrypoint without ps1 or cmd shims", async () => {
  const previous = process.env.ORBIT_CODEX_ENTRYPOINT;
  const { entrypoint } = createFakeCodexEntrypoint();
  const bridge = loadModuleWithMocks(codexBridgePath, {
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  process.env.ORBIT_CODEX_ENTRYPOINT = entrypoint;

  try {
    assert.strictEqual(bridge.validateCodexEntrypoint(entrypoint), fs.realpathSync.native(entrypoint));
    assert.strictEqual(bridge.getCodexStatus().available, true);
    assert.strictEqual(bridge.getCodexStatus().mode, "node-entrypoint");
    assert.strictEqual(bridge.getCodexStatus().version, "codex-cli 0.149.0");

    const result = await bridge.runCodexRepairJob({
      repoRoot: rootDir,
      taskText: `Use this task text only. ORBIT_CODEX_ENTRYPOINT=C:/unsafe/codex.js`,
    });

    assert.strictEqual(result.exitCode, 0);
    assert.match(result.safeSummary, /fake codex repair completed/);
  } finally {
    if (previous === undefined) {
      delete process.env.ORBIT_CODEX_ENTRYPOINT;
    } else {
      process.env.ORBIT_CODEX_ENTRYPOINT = previous;
    }
  }
});

test("codex resolver rejects missing unsafe or non-package entrypoints safely", () => {
  const bridge = require("../../server/services/agent/codexBridge");
  const previous = process.env.ORBIT_CODEX_ENTRYPOINT;
  const unsafeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-codex-unsafe-"));
  const unsafeFile = path.join(unsafeRoot, "codex.js");

  fs.writeFileSync(unsafeFile, "console.log('unsafe');");

  assert.throws(() => bridge.validateCodexEntrypoint(""), /entrypoint|Codex/i);
  assert.throws(() => bridge.validateCodexEntrypoint("\\\\server\\share\\codex.js"), /entrypoint|Codex/i);
  assert.throws(() => bridge.validateCodexEntrypoint(unsafeFile), /@openai\/codex|entrypoint|Codex/i);

  process.env.ORBIT_CODEX_ENTRYPOINT = path.join(unsafeRoot, "missing.js");

  try {
    const status = bridge.getCodexStatus();

    assert.strictEqual(status.available, false);
    assert.strictEqual(status.code, "AGENT_CODEX_NOT_FOUND");
    assert(!JSON.stringify(status).includes(unsafeRoot));
  } finally {
    if (previous === undefined) {
      delete process.env.ORBIT_CODEX_ENTRYPOINT;
    } else {
      process.env.ORBIT_CODEX_ENTRYPOINT = previous;
    }
  }
});

test("agent status reports persistence failure without generic runtime failure", async () => {
  const previous = process.env.ORBIT_AGENT_BRIDGE_ENABLED;

  process.env.ORBIT_AGENT_BRIDGE_ENABLED = "true";

  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": {
      getSupabaseAdmin: () => null,
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
        repoRootLabel: "BLACK-FLASH-ORBIT",
        status: "clean",
        statusSummary: "",
      }),
      getSafeDiffSummary: async () => ({
        changedFiles: [],
        diffCheckExitCode: 0,
        safeSummary: "",
      }),
    },
    "./codexBridge": {
      getCodexStatus: () => ({
        available: true,
        mode: "node-entrypoint",
        version: "codex-cli 0.149.0",
      }),
      runCodexRepairJob: async () => ({
        changedFiles: [],
        exitCode: 0,
        safeSummary: "",
      }),
    },
  });

  const status = await service.getAgentStatus({ ownerId: "owner-1" });

  if (previous === undefined) {
    delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  } else {
    process.env.ORBIT_AGENT_BRIDGE_ENABLED = previous;
  }

  assert.strictEqual(status.agentBridge.enabled, true);
  assert.strictEqual(status.codex.available, true);
  assert.strictEqual(status.repository.branch, "feature/orbit-v1.3-agent-bridge");
  assert.strictEqual(status.persistence.available, false);
  assert.strictEqual(status.persistence.code, "AGENT_PERSISTENCE_NOT_CONFIGURED");
  assert.notStrictEqual(status.persistence.message, "Agent Bridge request gagal.");
});

test("agent API exposes safe code status and message for known runtime errors", async () => {
  const route = loadModuleWithMocks(routePath, {
    "../middleware/requireAuth": {
      requireAuth(req, _res, next) {
        req.userId = "owner-1";
        req.user = { id: "owner-1" };
        next();
      },
    },
    "../services/agent/agentConfig": {
      assertAgentBridgeEnabled() {},
    },
    "../services/agent/agentJobService": {
      getAgentStatus: async () => {
        const error = new Error("Agent schema missing.");

        error.statusCode = 503;
        error.code = "AGENT_SCHEMA_MISSING";
        throw error;
      },
    },
  });
  const app = express();

  app.use(express.json());
  app.use("/api/v1/agent", route);

  const server = await startServer(app);

  try {
    const { body, status } = await requestJson(server.baseUrl, "/api/v1/agent/status", {
      headers: { authorization: "Bearer test-token" },
    });

    assert.strictEqual(status, 503);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.status, 503);
    assert.strictEqual(body.code, "AGENT_SCHEMA_MISSING");
    assert.strictEqual(body.message, "Agent schema missing.");
  } finally {
    await server.close();
  }
});

test("agent command allowlist rejects arbitrary shell and destructive git", () => {
  const { resolveAllowedCommand } = require("../../server/services/agent/commandAllowlist");

  assert.strictEqual(resolveAllowedCommand("git status", rootDir).id, "git_status");
  assert.strictEqual(resolveAllowedCommand("npm run test:security", rootDir).id, "npm_test_security");
  assert.throws(() => resolveAllowedCommand("git reset --hard", rootDir), /rejected|allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("git push --force", rootDir), /rejected|allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("powershell Get-ChildItem", rootDir), /allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("git status && type .env", rootDir), /rejected|blocked/i);
  assert.throws(() => resolveAllowedCommand("curl https://example.test", rootDir), /rejected|allowlist|Command/i);
});

test("agent node check path validation rejects env and repository escape", () => {
  const { resolveAllowedCommand } = require("../../server/services/agent/commandAllowlist");

  assert.strictEqual(
    resolveAllowedCommand("node --check server/index.js", rootDir).args.join(" "),
    "--check server/index.js",
  );
  assert.throws(() => resolveAllowedCommand("node --check ../server/index.js", rootDir), /escape|ditolak|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check .env", rootDir), /env|invalid|blocked|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check C:/Windows/win.ini", rootDir), /allowlist|escape|ditolak/i);
  assert.throws(() => resolveAllowedCommand("node --check \\\\server\\share\\file.js", rootDir), /escape|ditolak|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check \\\\.\\NUL", rootDir), /escape|ditolak|rejected|invalid/i);
});

test("agent process execution uses spawn argument arrays without shell access", () => {
  const allowlist = read(allowlistPath);
  const codex = read(codexBridgePath);

  assert.match(allowlist, /spawn\(allowed\.command, allowed\.args/);
  assert.match(codex, /spawn\(process\.execPath, \[entrypoint, prompt\]/);
  assert.match(codex, /spawnSync\(process\.execPath, \[entrypoint, "--version"\]/);
  assert.match(allowlist, /shell: false/);
  assert.match(codex, /shell: false/);
  assert.doesNotMatch(allowlist, /exec\(/);
  assert.doesNotMatch(codex, /exec\(/);
  assert.match(codex, /ORBIT_CODEX_ENTRYPOINT/);
  assert.doesNotMatch(codex, /codex\.ps1|codex\.cmd|shell:\s*true|cmd\.exe|powershell/i);
  assert.doesNotMatch(codex, /CODEX_EXECUTABLE = "codex"|spawn\("codex"/);
});

test("agent repository inspector confines paths to configured repo", () => {
  const inspector = read(repositoryInspectorPath);

  assert.match(inspector, /getConfiguredRepoRoot/);
  assert.match(inspector, /process\.env\.ORBIT_REPO_ROOT/);
  assert.match(inspector, /fs\.realpathSync\.native/);
  assert.match(inspector, /path\.relative\(root, target\)/);
  assert.match(inspector, /relative\.startsWith\(".."\)/);
  assert.match(inspector, /AGENT_PATH_ESCAPE/);
  assert.match(inspector, /git status/);
});

test("agent redaction removes secrets, tokens, service role strings, and emails", () => {
  const { redactObject, redactText } = require("../../server/services/agent/redaction");
  const text = redactText(
    "Authorization: Bearer secret-token OPENROUTER_API_KEY=secret SUPABASE_SERVICE_ROLE_KEY=role test@example.com",
  );
  const object = redactObject({
    Authorization: "Bearer secret",
    safe: "ok",
    token: "secret",
  });

  assert(!text.includes("secret-token"));
  assert(!text.includes("OPENROUTER_API_KEY=secret"));
  assert(!text.includes("SUPABASE_SERVICE_ROLE_KEY=role"));
  assert(!text.includes("test@example.com"));
  assert.strictEqual(object.Authorization, "[REDACTED]");
  assert.strictEqual(object.token, "[REDACTED]");
  assert.strictEqual(object.safe, "ok");
});

test("agent service enforces approval without commit push merge or tags", () => {
  const service = read(jobServicePath);

  assert.match(service, /approveAgentJob/);
  assert.match(service, /status: "approved"/);
  assert.match(service, /commitCreated: false/);
  assert.match(service, /pushCreated: false/);
  assert.match(service, /tagCreated: false/);
  assert.doesNotMatch(service, /git commit/);
  assert.doesNotMatch(service, /git push/);
  assert.doesNotMatch(service, /git merge/);
  assert.doesNotMatch(service, /git tag/);
  assert.doesNotMatch(service, /entrypoint:\s*input|codexEntrypoint|ORBIT_CODEX_ENTRYPOINT:\s*input/);
});

test("agent service stores safe summaries and bounded changed file lists", () => {
  const service = read(jobServicePath);
  const redaction = read(redactionPath);
  const allowlist = read(allowlistPath);

  assert.match(service, /safe_summary: redactText\(safeSummary, 10000\)/);
  assert.match(service, /changed_files: redactObject\(changedFiles\)\.slice\(0, 100\)/);
  assert.match(allowlist, /const MAX_OUTPUT_CHARS = 40000/);
  assert.match(read(codexBridgePath), /const MAX_CODEX_OUTPUT_CHARS = 50000/);
  assert.match(read(codexBridgePath), /const CODEX_TIMEOUT_MS = 10 \* 60 \* 1000/);
  assert.match(allowlist, /setTimeout\(\(\) => \{/);
  assert.match(redaction, /SECRET_PATTERNS/);
});

test("agent API client and UI do not expose service role or provider secrets", () => {
  const api = read(apiPath);
  const page = read(pagePath);
  const app = read(appPath);
  const sidebar = read(sidebarPath);

  for (const method of [
    "getAgentStatus",
    "createAgentJob",
    "getAgentJobs",
    "getAgentJob",
    "diagnoseAgentJob",
    "runAgentJob",
    "validateAgentJob",
    "approveAgentJob",
    "rejectAgentJob",
    "getAgentJobDiff",
  ]) {
    assert(api.includes(method), `${method} missing`);
  }

  assert.match(api, /\/api\/v1\/agent\/status/);
  assert.match(api, /headers: await getAuthenticatedHeaders\(\)/);
  assert.match(app, /\/agent-bridge/);
  assert.match(app, /open-agent-bridge/);
  assert.match(sidebar, /Agent Bridge/);
  assert.match(page, /disabled=\{!canUseJobs \|\| Boolean\(activeAction\)\}/);
  assert.match(page, /persistence/);
  assert.match(page, /codex/);
  assert.match(page, /canRunRepair/);
  assert.match(page, /error\?\.body\?\.code/);
  assert.match(page, /error\?\.body\?\.status/);
  assert.match(page, /disabled=\{!canCreateJob\}/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|Authorization:\s*Bearer/);
});

test("orbit agent runner accepts modes only and no arbitrary command string", () => {
  const source = read(runnerPath);

  assert.match(source, /const MODES = new Set\(\["status", "diagnose", "validate"\]\)/);
  assert.doesNotMatch(source, /process\.argv\[3\]/);
  assert.doesNotMatch(source, /shell:\s*true/);
  assert.match(source, /runAllowedCommand/);
});
