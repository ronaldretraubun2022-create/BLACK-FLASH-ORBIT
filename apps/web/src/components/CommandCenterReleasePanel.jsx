import { CheckCircle2, GitBranch, Rocket, ShieldCheck } from "lucide-react";

const releases = [
  {
    tag: "feature/security-center-v0.6",
    label: "Security Center v0.6 checkpoint",
  },
  {
    tag: "v0.4.8-extended-telemetry-meta",
    label: "Extended telemetry metadata",
  },
  {
    tag: "v0.4.7-command-center-operations",
    label: "Operations panel extraction",
  },
  {
    tag: "v0.4.6-command-center-panels",
    label: "Dashboard panel extraction",
  },
];

const checklist = [
  "Production build PASS",
  "Telemetry route connected",
  "Fallback states protected",
  "Component structure clean",
  "Working tree verified",
];

export function CommandCenterReleasePanel() {
  const [stableRelease, ...recentReleases] = releases;

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <article className="orbit-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
            <Rocket className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="orbit-kicker">Release Center</p>
            <h3 className="text-lg font-black text-white">Stable Checkpoint</h3>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              Current Stable
            </p>
          </div>
          <p className="mt-3 break-all font-mono text-sm font-bold text-white">
            {stableRelease.tag}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-300">
            {stableRelease.label}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {recentReleases.map((release) => (
            <div
              key={release.tag}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-semibold text-zinc-200">
                  {release.tag}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{release.label}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="orbit-card p-5">
        <p className="orbit-kicker">Deployment Checklist</p>

        <div className="mt-5 space-y-3">
          {checklist.map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <span className="text-zinc-300">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            Security Center v0.6
          </p>
          <p className="mt-2 text-sm font-bold text-white">
            feature/security-center-v0.6
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            Current focus: visualize audit routes, auth protection, rate limits,
            and defensive security status.
          </p>
        </div>
      </article>
    </section>
  );
}
