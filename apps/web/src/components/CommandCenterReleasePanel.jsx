import {
  Activity,
  CheckCircle2,
  FileText,
  GitBranch,
  Rocket,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

const projectHealthItems = [
  {
    label: "Build Status",
    value: "PASS",
    detail: "npm run build verified",
    icon: Rocket,
    tone: "text-emerald-300",
  },
  {
    label: "Git Branch",
    value: "feature/project-health-v0.7",
    detail: "current release branch",
    icon: GitBranch,
    tone: "text-amber-200",
  },
  {
    label: "Latest Commit",
    value: "Security Center v0.6 -> v0.7",
    detail: "metadata checkpoint updated",
    icon: FileText,
    tone: "text-white",
  },
  {
    label: "Runtime Health",
    value: "Healthy",
    detail: "dashboard telemetry live",
    icon: Activity,
    tone: "text-cyan-300",
  },
];

const moduleHealthItems = [
  {
    name: "Auth Layer",
    status: "Validated",
    detail: "route protection, session checks",
  },
  {
    name: "Newsroom Engine",
    status: "Online",
    detail: "draft flow and telemetry ready",
  },
  {
    name: "Web Builder",
    status: "Stable",
    detail: "preview, export, ZIP, publish preserved",
  },
  {
    name: "Security Center",
    status: "Secured",
    detail: "audit, fallback, and protection active",
  },
];

const readinessChecks = [
  "Branch metadata updated",
  "Build verification PASS",
  "Runtime health visible",
  "Module health summarized",
  "Deployment signals ready",
];

const systemReport = [
  { label: "Mode", value: "Dark glass dashboard" },
  { label: "Routing", value: "Current routes preserved" },
  { label: "UI Scope", value: "Mobile-first responsive" },
  { label: "Release", value: "Project Health Monitor v0.7" },
];

export function CommandCenterReleasePanel() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <article className="orbit-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">Project Health Monitor</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              v0.7 release status
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Live dashboard ringkasan build, branch, commit terakhir, runtime,
              dan status modul untuk kontrol rilis yang cepat dibaca.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
            <Rocket className="h-5 w-5 text-cyan-300" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {projectHealthItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                    {item.label}
                  </p>
                  <Icon className={item.tone} size={18} />
                </div>
                <p className={`mt-3 text-lg font-black ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              Deployment Readiness
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {readinessChecks.map((item) => (
              <div
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-200"
                key={item}>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="orbit-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">System Report</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Runtime and module overview
            </h3>
          </div>
          <TerminalSquare className="text-cyan-300" size={26} />
        </div>

        <div className="mt-5 grid gap-3">
          {moduleHealthItems.map((item) => (
            <div
              className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              key={item.name}>
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{item.name}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {item.detail}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                {item.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
          {systemReport.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            System Note
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Build, runtime, and deployment telemetry are presented as dashboard
            metadata only. Routing and existing feature behavior remain intact.
          </p>
        </div>
      </article>
    </section>
  );
}
