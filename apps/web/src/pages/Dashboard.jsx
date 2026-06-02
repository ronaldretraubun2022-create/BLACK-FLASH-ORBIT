import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { StatusCard } from "../components/cards/StatusCard";
import { api } from "../services/api";

const modules = [
  {
    id: "ai-workspace",
    title: "AI Workspace",
    description: "Generate berita, transkrip audio, dan produksi visual AI.",
    icon: Bot,
  },
  {
    id: "monitoring",
    title: "Live Monitoring",
    description: "Pantau kesehatan backend dan alur kerja newsroom.",
    icon: Activity,
  },
  {
    id: "security",
    title: "Security Center",
    description: "Kontrol akses admin dan perlindungan sistem produksi.",
    icon: ShieldCheck,
  },
  {
    id: "reports",
    title: "Reports Archive",
    description: "Kelola arsip berita dan ekspor laporan operasional.",
    icon: FileText,
  },
];

const activities = [
  {
    title: "Backend health monitoring initialized",
    detail: "Production health endpoint connected through the Vite proxy.",
    time: "Live",
  },
  {
    title: "AI newsroom workspace ready",
    detail: "Editorial, transcription, and visual modules are available.",
    time: "Ready",
  },
  {
    title: "Security channel protected",
    detail: "Dashboard shell loaded with defensive monitoring enabled.",
    time: "Active",
  },
];

export function Dashboard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setHealth(await api.getHealth());
    } catch (requestError) {
      setHealth(null);
      setError(requestError.message || "Unable to reach backend service.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="mx-auto max-w-7xl" id="dashboard">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
            NEWSROOM OPERATIONS SYSTEM
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            BLACK FLASH ORBIT
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
            Dashboard terpadu untuk operasi jurnalistik, produksi multimedia,
            dan pemantauan sistem AI secara real-time.
          </p>
        </div>
      </section>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
            SYSTEM TELEMETRY
          </p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
            Backend Status
          </h2>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
          disabled={isLoading}
          onClick={loadHealth}
          type="button"
        >
          <RefreshCw className={isLoading ? "animate-spin" : ""} size={15} />
          Refresh
        </button>
      </div>

      <div className="mt-4">
        <StatusCard error={error} health={health} isLoading={isLoading} />
      </div>

      <section className="mt-8">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
            ORBIT MODULES
          </p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
            Operational Workspace
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map(({ id, title, description, icon: Icon }) => (
            <article
              className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.055]"
              id={id}
              key={id}
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
                <Icon size={19} />
              </span>
              <h3 className="mt-5 text-base font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
              <span className="mt-5 inline-block text-[10px] font-black tracking-[0.2em] text-slate-500 transition group-hover:text-cyan-300">
                MODULE READY
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
            ACTIVITY STREAM
          </p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
            Recent Activity
          </h2>
        </div>

        <div className="mt-5 grid gap-3">
          {activities.map(({ title, detail, time }) => (
            <article
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4"
              key={title}
            >
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_#67e8f9]" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-200">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                {time}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"
        id="settings"
      >
        <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
          SYSTEM SETTINGS
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">
              Production Foundation Ready
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Responsive dashboard shell, Tailwind v4, dan reusable API service
              aktif.
            </p>
          </div>
          <span className="mt-2 inline-flex w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-cyan-300 sm:mt-0">
            OPERATIONAL
          </span>
        </div>
      </section>
    </div>
  );
}
