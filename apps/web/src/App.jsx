import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserMenu } from "./components/auth/UserMenu.jsx";
import { useProfile } from "./hooks/useProfile.js";
import { AINewsroom } from "./pages/AINewsroom.jsx";
import {
  Archive,
  Bell,
  Bot,
  CheckCircle2,
  FileText,
  Gauge,
  Image,
  Lock,
  Mic2,
  Newspaper,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
} from "lucide-react";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/auth/ProtectedRoute.jsx";
import { CommandCenterHero } from "./components/CommandCenterHero.jsx";
import { CommandCenterActivityPanel } from "./components/CommandCenterActivityPanel.jsx";
import { CommandCenterMetricGrid } from "./components/CommandCenterMetricGrid.jsx";
import { CommandCenterOperationsPanel } from "./components/CommandCenterOperationsPanel.jsx";
import { CommandCenterReleasePanel } from "./components/CommandCenterReleasePanel.jsx";
import { CommandCenterSecurityPanel } from "./components/CommandCenterSecurityPanel.jsx";
import { CommandCenterSidebar } from "./components/CommandCenterSidebar.jsx";
import { Login } from "./pages/Login.jsx";
import { Register } from "./pages/Register.jsx";
import { WebBuilder } from "./pages/WebBuilder.jsx";
import { getAuthenticatedHeaders } from "./services/api.js";

const adminRoles = new Set(["admin", "owner", "super_admin"]);

const releaseState = [
  { label: "Branch", value: "sprint3-dev", tone: "text-amber-300" },
  { label: "Tag", value: "v0.5.5-rbac", tone: "text-white" },
  { label: "Status", value: "role-guarded", tone: "text-emerald-300" },
];

const commandStats = [
  {
    label: "AI Drafts",
    value: "248",
    detail: "generated articles",
    icon: Newspaper,
  },
  {
    label: "Transcripts",
    value: "91.8%",
    detail: "avg confidence",
    icon: Mic2,
  },
  {
    label: "Media Assets",
    value: "1.7K",
    detail: "indexed files",
    icon: Image,
  },
  {
    label: "Ops Health",
    value: "99.9",
    detail: "uptime score",
    icon: Gauge,
  },
];

const newsroomFlow = [
  {
    title: "Capture",
    body: "Audio lapangan, foto, catatan, dan metadata lokasi masuk ke intake desk.",
    icon: UploadCloud,
    progress: "92%",
  },
  {
    title: "Transcribe",
    body: "Speech-to-text diproses untuk membuat kutipan, ringkasan, dan kronologi.",
    icon: Radio,
    progress: "88%",
  },
  {
    title: "Compose",
    body: "AI newsroom menyusun lead, isi berita, kutipan, dan penutup jurnalistik.",
    icon: Bot,
    progress: "76%",
  },
  {
    title: "Archive",
    body: "Draft, sumber, PDF, dan riwayat editorial diamankan ke arsip terstruktur.",
    icon: Archive,
    progress: "100%",
  },
];

const aiModules = [
  { name: "News Generator", icon: FileText, state: "Ready" },
  { name: "Audio Transcript", icon: Mic2, state: "Online" },
  { name: "Image Prompt Studio", icon: Sparkles, state: "Active" },
  { name: "Admin Control", icon: ShieldCheck, state: "Secured" },
];

const liveBriefs = [
  {
    desk: "Papua Selatan Desk",
    title: "Pemantauan isu publik dan agenda pemerintahan daerah",
    time: "09:42 WIT",
  },
  {
    desk: "Multimedia Desk",
    title: "Kurasi visual lapangan untuk paket berita sore",
    time: "10:18 WIT",
  },
  {
    desk: "Editorial Desk",
    title: "Validasi narasumber, kutipan, dan konteks publikasi",
    time: "10:55 WIT",
  },
];

const securitySignals = [
  { label: "Role Admin", value: "validated", icon: Lock },
  { label: "Firestore Reads", value: "optimized", icon: Zap },
  { label: "Audit Trail", value: "enabled", icon: CheckCircle2 },
];

function isAdminRole(role) {
  return adminRoles.has(String(role || "").toLowerCase());
}

function formatMetric(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: value % 1 === 0 ? 0 : 1,
    }).format(value);
  }

  return String(value);
}

function formatUptime(seconds, fallback = "live") {
  if (!Number.isFinite(seconds)) return fallback;

  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;

  return `${Math.max(0, Math.floor(seconds))}s`;
}

function formatTime(value, fallback) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jayapura",
  });
}

function getObjectValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value);
}

function CommandCenterDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState("");
  const { profile } = useProfile();

  const userRole = profile?.role || "user";
  const canAccessSecurity = isAdminRole(userRole);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardTelemetry() {
      setIsTelemetryLoading(true);
      setTelemetryError("");

      try {
        const authHeaders = await getAuthenticatedHeaders();
        const response = await fetch("/api/v1/dashboard/status", {
          headers: { Accept: "application/json", ...authHeaders },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Telemetry request failed: ${response.status}`);
        }

        const payload = await response.json();
        setDashboardData(payload?.data ?? null);
      } catch (error) {
        if (error?.name === "AbortError") return;

        setTelemetryError(error?.message || "Telemetry unavailable");
        setDashboardData(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsTelemetryLoading(false);
        }
      }
    }

    loadDashboardTelemetry();

    return () => controller.abort();
  }, []);

  const hasTelemetryData = Boolean(dashboardData);
  const hasActivity =
    Array.isArray(dashboardData?.activity) && dashboardData.activity.length > 0;
  const hasProjects =
    Array.isArray(dashboardData?.projects) && dashboardData.projects.length > 0;
  const hasAutomation = getObjectValues(dashboardData?.automation).length > 0;
  const isTelemetryConnected =
    hasTelemetryData && !isTelemetryLoading && !telemetryError;
  const isUsingFallback =
    isTelemetryLoading ||
    Boolean(telemetryError) ||
    !hasTelemetryData ||
    (isTelemetryConnected && (!hasActivity || !hasProjects || !hasAutomation));

  const telemetryStatusText = isTelemetryLoading
    ? "Syncing backend telemetry..."
    : telemetryError
      ? `Telemetry fallback active: ${telemetryError}`
      : isTelemetryConnected && !hasActivity && !hasProjects && !hasAutomation
        ? "Telemetry connected, waiting for records."
        : "Backend telemetry live.";

  const telemetryLabels = [
    {
      label: "Runtime",
      value: dashboardData?.system?.runtime || "not reported",
    },
    {
      label: "Health Module",
      value: dashboardData?.health?.module || "not reported",
    },
    {
      label: "Metrics Timestamp",
      value: dashboardData?.metrics?.timestamp
        ? formatTime(dashboardData.metrics.timestamp, "not reported")
        : "not reported",
    },
  ];

  const {
    automationItems,
    dashboardStats,
    healthStatus,
    liveBriefItems,
    projectFlow,
    securityItems,
    uptimeLabel,
  } = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    const health = dashboardData?.health ?? {};
    const projects = Array.isArray(dashboardData?.projects)
      ? dashboardData.projects
      : [];
    const security = dashboardData?.security ?? {};
    const activity = Array.isArray(dashboardData?.activity)
      ? dashboardData.activity
      : [];
    const automation = getObjectValues(dashboardData?.automation);
    const projectCount = metrics?.projects ?? projects.length;
    const reportCount = metrics?.reports;
    const uptime = metrics?.uptime ?? health?.uptime;
    const computedUptime = formatUptime(uptime, commandStats[3].value);
    const computedHealth = health?.status || commandStats[3].value;

    return {
      automationItems: automation,
      dashboardStats: [
        {
          ...commandStats[0],
          value: formatMetric(reportCount, commandStats[0].value),
          detail:
            reportCount === null || reportCount === undefined
              ? commandStats[0].detail
              : "reports tracked",
        },
        {
          ...commandStats[1],
          value: formatMetric(projectCount, commandStats[1].value),
          detail:
            projectCount === null || projectCount === undefined
              ? commandStats[1].detail
              : "projects synced",
        },
        {
          ...commandStats[2],
          value: formatMetric(activity.length || null, commandStats[2].value),
          detail: activity.length ? "activity signals" : commandStats[2].detail,
        },
        {
          ...commandStats[3],
          value: formatMetric(computedHealth, commandStats[3].value),
          detail: `uptime ${computedUptime}`,
        },
      ],
      healthStatus: computedHealth,
      liveBriefItems: hasActivity
        ? activity.slice(0, 3).map((item, index) => ({
            desk: `${item?.type || "system"} desk`,
            title:
              item?.message || liveBriefs[index]?.title || "Telemetry event",
            time: formatTime(item?.time, liveBriefs[index]?.time || "live"),
          }))
        : isTelemetryConnected
          ? [
              {
                desk: "Telemetry",
                title: "No live activity yet.",
                time: "live",
              },
            ]
          : liveBriefs,
      projectFlow: hasProjects
        ? projects.slice(0, 4).map((project, index) => ({
            title:
              project?.name || newsroomFlow[index]?.title || "ORBIT Module",
            body: `${project?.type || "workspace"} status ${project?.status || "READY"} - last scan ${project?.lastScan || "live"}`,
            icon: newsroomFlow[index]?.icon || Archive,
            progress: `${formatMetric(project?.score, newsroomFlow[index]?.progress?.replace("%", "") || "100")}%`,
          }))
        : isTelemetryConnected
          ? [
              {
                title: "No synced projects yet.",
                body: "Backend telemetry connected. Project records belum tersedia.",
                icon: Archive,
                progress: "0%",
              },
            ]
          : newsroomFlow,
      securityItems: [
        {
          ...securitySignals[0],
          value: security?.helmet || securitySignals[0].value,
        },
        {
          ...securitySignals[1],
          value: security?.rateLimit || securitySignals[1].value,
        },
        {
          ...securitySignals[2],
          value:
            security?.securityScore !== null &&
            security?.securityScore !== undefined
              ? `${security.securityScore}/100`
              : securitySignals[2].value,
        },
      ],
      uptimeLabel: computedUptime,
    };
  }, [dashboardData, hasActivity, hasProjects, isTelemetryConnected]);

  const moduleItems = useMemo(() => {
    if (!automationItems.length) return aiModules;

    return automationItems.slice(0, 4).map((engine, index) => ({
      name: engine?.name || aiModules[index]?.name || "Automation Engine",
      icon: aiModules[index]?.icon || Bot,
      state: engine?.status || aiModules[index]?.state || "Ready",
    }));
  }, [automationItems]);

  const displayedModuleItems = useMemo(() => {
    if (hasAutomation) return moduleItems;

    return moduleItems.map((module) => ({
      ...module,
      state: isTelemetryConnected ? "fallback-ready" : module.state,
    }));
  }, [hasAutomation, isTelemetryConnected, moduleItems]);

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar releaseState={releaseState} userRole={userRole} />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Command Center</p>
              <h2 className="text-xl font-black text-white md:text-2xl">
                Newsroom Intelligence Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button aria-label="Search" className="orbit-icon-button">
                <Search size={18} />
              </button>

              <button aria-label="Notifications" className="orbit-icon-button">
                <Bell size={18} />
              </button>

              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="grid gap-4">
              <CommandCenterHero
                healthStatus={formatMetric(healthStatus, "Live Signal")}
                isTelemetryLoading={isTelemetryLoading}
                isUsingFallback={isUsingFallback}
                releaseState={releaseState}
                telemetryError={telemetryError}
                telemetryLabels={telemetryLabels}
                telemetryStatusText={telemetryStatusText}
                uptimeLabel={uptimeLabel}
              />

              <CommandCenterMetricGrid dashboardStats={dashboardStats} />
              <CommandCenterReleasePanel />

              <CommandCenterOperationsPanel
                displayedModuleItems={displayedModuleItems}
                projectFlow={projectFlow}
              />
            </section>

            <aside className="grid gap-4">
              <CommandCenterActivityPanel
                liveBriefItems={liveBriefItems}
                securityItems={securityItems}
              />

              {canAccessSecurity && (
                <CommandCenterSecurityPanel
                  securityItems={securityItems}
                  healthStatus={formatMetric(healthStatus, "READY")}
                />
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CommandCenterDashboard />} />
        <Route path="/ai-newsroom" element={<AINewsroom />} />
        <Route path="/web-builder" element={<WebBuilder />} />
      </Route>

      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;
