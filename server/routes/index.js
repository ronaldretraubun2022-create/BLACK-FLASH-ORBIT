const express = require("express");
const supabase = require("../lib/supabase");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

const fallbackProjects = [
  {
    name: "BLACK-FLASH-ORBIT",
    type: "platform",
    status: "ACTIVE",
    score: 96,
    lastScan: "2 min ago",
  },
  {
    name: "ORBIT-DASHBOARD",
    type: "frontend",
    status: "SYNCED",
    score: 92,
    lastScan: "18 min ago",
  },
  {
    name: "SECURITY-AUDIT-CORE",
    type: "security",
    status: "READY",
    score: 88,
    lastScan: "42 min ago",
  },
  {
    name: "CLI-AUTOMATION",
    type: "automation",
    status: "ACTIVE",
    score: 90,
    lastScan: "1 hour ago",
  },
];

const fallbackReports = [
  {
    id: "RPT-2026-001",
    type: "workspace-audit",
    score: 96,
    createdAt: "2026-05-31T18:40:00.000Z",
    status: "READY",
  },
  {
    id: "RPT-2026-002",
    type: "security-review",
    score: 94,
    createdAt: "2026-05-31T18:15:00.000Z",
    status: "SYNCED",
  },
  {
    id: "RPT-2026-003",
    type: "dependency-scan",
    score: 91,
    createdAt: "2026-05-31T17:55:00.000Z",
    status: "ACTIVE",
  },
  {
    id: "RPT-2026-004",
    type: "build-validation",
    score: 98,
    createdAt: "2026-05-31T17:30:00.000Z",
    status: "READY",
  },
];

const promptCategories = [
  "newsroom",
  "osint",
  "engineering",
  "security",
  "product",
  "audit",
  "codex",
  "backend",
  "frontend",
  "database",
  "supabase",
  "automation",
  "monitoring",
  "reports",
  "ai",
  "devops",
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
  moduleInstaller: {
    name: "Module Registry",
    status: "SYNCED",
    description:
      "Coordinate approved module installation and dependency readiness.",
  },
  deployEngine: {
    name: "Deploy Pipeline",
    status: "READY",
    description: "Prepare validated production builds for controlled release.",
  },
};

const automationJobs = [
  {
    id: "workspace-audit",
    engine: "auditEngine",
    name: "Workspace Audit",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/audit/run",
  },
  {
    id: "build-validation",
    engine: "deployEngine",
    name: "Build Validation",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/automation/jobs",
  },
  {
    id: "security-review",
    engine: "fixEngine",
    name: "Security Review",
    status: "READY",
    schedule: "manual",
    route: "/api/v1/security",
  },
];

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    score: row.score,
    lastScan: row.last_scan || "just now",
  };
}

function mapReport(row) {
  return {
    id: row.id,
    type: row.type,
    score: row.score,
    createdAt: row.created_at,
    status: row.status,
  };
}

function mapPrompt(row) {
  return {
    id: row.id,
    title: row.title,
    category: normalizePromptCategory(row.category),
    content: row.content,
    userId: row.user_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    time: row.time || row.created_at || new Date().toISOString(),
  };
}

function mapProfile(row, authUser) {
  const fallback = createFallbackProfile(authUser);

  return {
    id: row.id || fallback.id,
    email: row.email || fallback.email,
    fullName: row.full_name || fallback.fullName,
    role: row.role || fallback.role,
    avatarInitials: row.avatar_initials || fallback.avatarInitials,
    workspace: row.workspace || fallback.workspace,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePromptCategory(value, fallback = "newsroom") {
  const normalized = normalizeText(value).toLowerCase();

  return normalized || fallback;
}

function getPromptCategories(extraCategories = []) {
  const defaultCategorySet = new Set(promptCategories);
  const extraCategorySet = new Set();

  extraCategories
    .map((category) => normalizePromptCategory(category, ""))
    .filter(Boolean)
    .filter((category) => !defaultCategorySet.has(category))
    .forEach((category) => extraCategorySet.add(category));

  return [...promptCategories, ...Array.from(extraCategorySet).sort()];
}

function getAuthUserId(user) {
  return normalizeText(user?.id);
}

function getAuthUserEmail(user) {
  return normalizeText(user?.email || user?.user_metadata?.email);
}

function getAuthUserFullName(user) {
  const metadata = user?.user_metadata || {};

  return normalizeText(
    metadata.full_name || metadata.name || metadata.display_name,
    getAuthUserEmail(user).split("@")[0] || "Authenticated User",
  );
}

function createAvatarInitials(value) {
  const words = normalizeText(value, "U")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function createFallbackProfile(user) {
  const email = getAuthUserEmail(user);
  const fullName = getAuthUserFullName(user);

  return {
    id: getAuthUserId(user),
    email,
    fullName,
    role: "user",
    avatarInitials: createAvatarInitials(fullName || email),
    workspace: "BLACK FLASH ORBIT",
  };
}

function createFallbackPrompts(user) {
  const now = new Date().toISOString();
  const ownerId = getAuthUserId(user);
  const fallbackPromptMap = {
    newsroom: {
      title: "Newsroom Brief Generator",
      content: "Buat ringkasan berita cepat, faktual, dan siap publikasi.",
    },
    osint: {
      title: "OSINT Entity Analysis",
      content: "Analisis entitas publik secara etis dari sumber terbuka.",
    },
    engineering: {
      title: "Engineering Review",
      content:
        "Audit perubahan kode, risiko regresi, performa, dan rekomendasi patch production-ready.",
    },
    security: {
      title: "Security Risk Review",
      content:
        "Identifikasi risiko keamanan, validasi akses, dan langkah mitigasi defensif.",
    },
    product: {
      title: "Product Brief",
      content:
        "Susun brief produk berisi masalah pengguna, scope MVP, user flow, dan acceptance criteria.",
    },
    audit: {
      title: "Audit Report",
      content:
        "Buat laporan audit ringkas berisi temuan, severity, dampak, dan rekomendasi final.",
    },
    codex: {
      title: "Codex Operator Task",
      content:
        "Ubah instruksi menjadi task coding terstruktur dengan file target, batasan, dan test wajib.",
    },
    backend: {
      title: "Backend API Patch",
      content:
        "Rancang patch backend aman untuk endpoint, validasi input, ownership, dan error response.",
    },
    frontend: {
      title: "Frontend UI Patch",
      content:
        "Rancang perubahan UI responsif dengan state loading, empty, error, dan interaksi jelas.",
    },
    database: {
      title: "Database Migration Plan",
      content:
        "Buat rencana migrasi database aman, idempotent, indexed, dan kompatibel dengan data lama.",
    },
    supabase: {
      title: "Supabase RLS Review",
      content:
        "Review schema Supabase, RLS policy, auth.uid ownership, index, dan query efisien.",
    },
    automation: {
      title: "Automation Workflow",
      content:
        "Susun workflow automation untuk job, status, history, retry, dan observability.",
    },
    monitoring: {
      title: "Monitoring Checklist",
      content:
        "Buat checklist monitoring health, metrics, logs, alert, dan indikator service readiness.",
    },
    reports: {
      title: "Executive Report",
      content:
        "Buat report profesional berisi summary, data utama, analisis, risiko, dan next action.",
    },
    ai: {
      title: "AI Prompt Optimizer",
      content:
        "Optimalkan prompt AI agar instruksi jelas, konteks cukup, output terstruktur, dan aman.",
    },
    devops: {
      title: "DevOps Release Plan",
      content:
        "Susun release plan berisi build, env, migration, rollback, dan post-deploy verification.",
    },
  };

  return promptCategories.map((category) => ({
    id: `fallback-${category}`,
    title: fallbackPromptMap[category].title,
    category,
    content: fallbackPromptMap[category].content,
    userId: ownerId,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  }));
}

function getPromptOwnerFilter(user) {
  const ownerId = getAuthUserId(user);

  return `user_id.eq.${ownerId},created_by.eq.${ownerId}`;
}

async function getProjects() {
  if (!supabase) return fallbackProjects;

  const { data, error } = await supabase
    .from("orbit_projects")
    .select("id, name, type, status, score, last_scan, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase projects error:", error.message);
    return fallbackProjects;
  }

  return data.map(mapProject);
}

async function getReports() {
  if (!supabase) return fallbackReports;

  const { data, error } = await supabase
    .from("orbit_reports")
    .select("id, type, score, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase reports error:", error.message);
    return fallbackReports;
  }

  return data.map(mapReport);
}

async function getPrompts(user) {
  if (!supabase) return createFallbackPrompts(user);

  const { data, error } = await supabase
    .from("orbit_prompts")
    .select(
      "id, title, category, content, user_id, created_by, created_at, updated_at",
    )
    .or(getPromptOwnerFilter(user))
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Supabase prompts error:", error.message);
    return createFallbackPrompts(user);
  }

  return data.map(mapPrompt);
}

async function getPromptCategoriesFromDatabase() {
  if (!supabase) return getPromptCategories();

  const { data, error } = await supabase
    .from("orbit_prompt_categories")
    .select("slug")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase prompt categories error:", error.message);
    return getPromptCategories();
  }

  return getPromptCategories((data || []).map((category) => category.slug));
}

async function getActivity(limit = 20) {
  if (!supabase) {
    return [
      {
        type: "system",
        message: "ORBIT backend online",
        time: new Date().toISOString(),
      },
    ];
  }

  const { data, error } = await supabase
    .from("orbit_activity")
    .select("id, type, message, time, created_at")
    .order("time", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase activity error:", error.message);

    return [
      {
        type: "system",
        message: "ORBIT backend online",
        time: new Date().toISOString(),
      },
    ];
  }

  return data.map(mapActivity);
}

async function getProfile(user) {
  const fallbackProfile = createFallbackProfile(user);

  if (!supabase) return fallbackProfile;

  const columns =
    "id, email, full_name, role, avatar_initials, workspace, created_at, updated_at";

  const { data: profileById, error: profileByIdError } = await supabase
    .from("orbit_profiles")
    .select(columns)
    .eq("id", user.id)
    .maybeSingle();

  if (profileByIdError) {
    console.error("Supabase profile by id error:", profileByIdError.message);
    return fallbackProfile;
  }

  if (profileById) return mapProfile(profileById, user);

  const email = getAuthUserEmail(user);

  if (!email) return fallbackProfile;

  const { data: profileByEmail, error: profileByEmailError } = await supabase
    .from("orbit_profiles")
    .select(columns)
    .eq("email", email)
    .maybeSingle();

  if (profileByEmailError) {
    console.error(
      "Supabase profile by email error:",
      profileByEmailError.message,
    );
    return fallbackProfile;
  }

  return profileByEmail ? mapProfile(profileByEmail, user) : fallbackProfile;
}

function getAutomationEngines() {
  return automationEngines;
}

function getAutomationStatus(user) {
  const engines = Object.values(automationEngines);
  const readyEngines = engines.filter((engine) =>
    ["ACTIVE", "ONLINE", "READY", "SYNCED"].includes(engine.status),
  );

  return {
    success: true,
    status: readyEngines.length === engines.length ? "READY" : "DEGRADED",
    userId: getAuthUserId(user),
    database: supabase ? "CONNECTED" : "NOT_CONFIGURED",
    uptime: process.uptime(),
    totalEngines: engines.length,
    readyEngines: readyEngines.length,
    timestamp: new Date().toISOString(),
  };
}

function getAutomationJobs(user) {
  return automationJobs.map((job) => ({
    ...job,
    ownerId: getAuthUserId(user),
    updatedAt: new Date().toISOString(),
  }));
}

function mapAutomationHistory(row) {
  return {
    id: row.id,
    jobId: row.type || "workspace-audit",
    reportCode: row.report_code,
    type: row.type,
    score: row.score,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

async function getAutomationHistory(user, limit = 25) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orbit_audit_reports")
    .select("id, report_code, type, score, status, summary, created_at")
    .eq("user_id", getAuthUserId(user))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase automation history error:", error.message);
    return [];
  }

  return (data || []).map(mapAutomationHistory);
}

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get("/healthz", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get("/system", (req, res) => {
  res.json({
    status: "online",
    apiVersion: "v1",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

router.get("/dashboard/status", async (req, res) => {
  const [projects, reports, activity] = await Promise.all([
    getProjects(),
    getReports(),
    getActivity(20),
  ]);

  return res.json({
    success: true,
    data: {
      activity,
      automation: getAutomationEngines(),
      health: {
        success: true,
        service: "BLACK FLASH ORBIT API",
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      metrics: {
        projects: projects.length,
        reports: reports.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      projects,
      security: {
        securityScore: 94,
        helmet: "PROTECTED",
        cors: "PROTECTED",
        rateLimit: "ACTIVE",
        lastAudit: "live",
        issues: [],
      },
      system: {
        status: "online",
        apiVersion: "v1",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
    },
  });
});

router.get("/metrics", async (req, res) => {
  const memory = process.memoryUsage();
  const [projects, reports] = await Promise.all([getProjects(), getReports()]);

  res.json({
    projects: projects.length,
    reports: reports.length,
    uptime: process.uptime(),
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
    },
  });
});

router.get("/activity", async (req, res) => {
  const activity = await getActivity(20);
  res.json(activity);
});

router.get("/reports/summary", async (req, res) => {
  const reports = await getReports();

  const totalReports = reports.length;
  const averageScore =
    totalReports === 0
      ? 0
      : Math.round(
          reports.reduce((sum, report) => sum + Number(report.score || 0), 0) /
            totalReports,
        );

  const statusCount = reports.reduce((acc, report) => {
    const status = report.status || "UNKNOWN";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    totalReports,
    averageScore,
    statusCount,
    latestReport: reports[0] || null,
  });
});

router.get("/reports/:id", async (req, res) => {
  const reportId = normalizeText(req.params?.id);

  if (!reportId) {
    return res.status(400).json({
      success: false,
      message: "Report id wajib diisi.",
    });
  }

  const reports = await getReports();
  const report = reports.find((item) => item.id === reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: `Report tidak ditemukan: ${reportId}`,
    });
  }

  return res.json({
    success: true,
    data: report,
  });
});

router.get("/monitoring", async (req, res) => {
  const memory = process.memoryUsage();

  const [projects, reports, activity] = await Promise.all([
    getProjects(),
    getReports(),
    getActivity(10),
  ]);

  res.json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "online",
    apiVersion: "v1",
    environment: process.env.NODE_ENV || "development",
    telemetry: {
      health: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    metrics: {
      projects: projects.length,
      reports: reports.length,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
    },
    activity,
    modules: {
      health: "ACTIVE",
      system: "ACTIVE",
      metrics: "ACTIVE",
      activity: "ACTIVE",
      security: "ACTIVE",
      osint: "ACTIVE",
      automation: "ACTIVE",
      workspace: "ACTIVE",
      reports: "ACTIVE",
      prompts: "ACTIVE",
    },
  });
});

router.get("/projects", async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

router.get("/reports", async (req, res) => {
  const reports = await getReports();
  res.json(reports);
});

router.get("/prompts/categories", requireAuth, async (req, res) => {
  const categories = await getPromptCategoriesFromDatabase();

  res.json({
    success: true,
    data: categories,
  });
});

router.get("/prompts", requireAuth, async (req, res) => {
  const prompts = await getPrompts(req.user);
  res.json(prompts);
});

router.post("/prompts", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: "Supabase belum dikonfigurasi.",
    });
  }

  const title = normalizeText(req.body?.title);
  const category = normalizePromptCategory(req.body?.category);
  const content = normalizeText(req.body?.content);

  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "title dan content wajib diisi.",
    });
  }

  const { data, error } = await supabase
    .from("orbit_prompts")
    .insert([
      {
        title,
        category,
        content,
        user_id: req.user.id,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      },
    ])
    .select(
      "id, title, category, content, user_id, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Supabase prompt insert error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan prompt.",
    });
  }

  return res.status(201).json({
    success: true,
    data: mapPrompt(data),
  });
});

router.delete("/prompts/:id", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: "Supabase belum dikonfigurasi.",
    });
  }

  const promptId = normalizeText(req.params?.id);

  if (!promptId) {
    return res.status(400).json({
      success: false,
      message: "Prompt id wajib diisi.",
    });
  }

  const { data, error } = await supabase
    .from("orbit_prompts")
    .delete()
    .eq("id", promptId)
    .or(getPromptOwnerFilter(req.user))
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Supabase prompt delete error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus prompt.",
    });
  }

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Prompt tidak ditemukan atau bukan milik user login.",
    });
  }

  return res.json({
    success: true,
    data: { id: promptId },
  });
});

router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfile(req.user);
  res.json(profile);
});

router.get("/security", (req, res) => {
  res.json({
    securityScore: 94,
    helmet: "PROTECTED",
    cors: "PROTECTED",
    rateLimit: "ACTIVE",
    lastAudit: "8 min ago",
    issues: [
      {
        id: "SEC-001",
        severity: "low",
        message: "Review development CORS policy before production deploy.",
      },
      {
        id: "SEC-002",
        severity: "low",
        message: "Rotate audit snapshots after the next release cycle.",
      },
    ],
  });
});

router.get("/osint", (req, res) => {
  res.json({
    mode: "DEFENSIVE_ONLY",
    status: "SAFE",
    backend: "workspace-ready",
    scraping: false,
    exploitation: false,
    privateDataAccess: false,
    message:
      "OSINT Workspace berjalan dalam mode legal defensive. Tidak menyediakan scraping agresif, bypass login, exploit, atau akses data privat.",
    entityTypes: [
      "Public figure",
      "Government program",
      "Public institution",
      "Company",
      "Location",
      "Community organization",
      "Project contractor",
    ],
    sourceCategories: [
      {
        id: "official-records",
        name: "Official Records",
        risk: "Low",
        credibility: "High",
      },
      {
        id: "news-archive",
        name: "News Archive",
        risk: "Medium",
        credibility: "Medium",
      },
      {
        id: "public-signal",
        name: "Public Signal",
        risk: "Medium",
        credibility: "Medium",
      },
      {
        id: "document-trail",
        name: "Document Trail",
        risk: "Low",
        credibility: "High",
      },
    ],
    workflow: [
      {
        step: 1,
        title: "Case Scope Defined",
        status: "Scope",
      },
      {
        step: 2,
        title: "Source Collection",
        status: "Collect",
      },
      {
        step: 3,
        title: "Cross-check Evidence",
        status: "Verify",
      },
      {
        step: 4,
        title: "Editorial Risk Review",
        status: "Review",
      },
    ],
    ethicalNotice: [
      "Gunakan hanya sumber terbuka yang sah, relevan, dan dapat diverifikasi.",
      "Respect privacy and consent.",
      "Record source provenance.",
      "Escalate sensitive findings to editor/legal review.",
    ],
  });
});

router.get("/automation", requireAuth, (req, res) => {
  res.json(getAutomationEngines());
});

router.get("/automation/status", requireAuth, (req, res) => {
  res.json(getAutomationStatus(req.user));
});

router.get("/automation/jobs", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: getAutomationJobs(req.user),
  });
});

router.get("/automation/history", requireAuth, async (req, res) => {
  const history = await getAutomationHistory(req.user);

  res.json({
    success: true,
    data: history,
  });
});

router.get("/workspace", (req, res) => {
  res.json({
    path: "D:\\Projects",
    totalProjects: 6,
    activeProject: "BLACK-FLASH-ORBIT",
    scannerStatus: "READY",
    lastScan: "2 min ago",
  });
});

router.get("/settings", (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || "development",
    apiVersion: "v1",
    workspacePath: "D:\\Projects",
    securityMode: "Defensive",
    appName: "BLACK FLASH ORBIT",
  });
});

module.exports = router;
