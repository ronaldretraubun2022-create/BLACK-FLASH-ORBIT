import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CloudLightning,
  Command,
  FileText,
  Gauge,
  Image,
  LayoutDashboard,
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

const releaseState = [
  { label: "Branch", value: "sprint3-dev", tone: "text-amber-300" },
  { label: "Tag", value: "v0.4.1-stable", tone: "text-white" },
  { label: "Status", value: "clean", tone: "text-emerald-300" },
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

function App() {
  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <aside className="orbit-sidebar">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg border border-amber-300/30 bg-amber-300 text-black shadow-[0_0_40px_rgba(217,173,87,0.22)]">
              <Command size={22} />
            </div>
            <div>
              <p className="orbit-kicker">BLACK FLASH</p>
              <h1 className="text-lg font-black leading-tight text-white">
                ORBIT
              </h1>
            </div>
          </div>

          <nav className="mt-8 grid gap-2">
            {[
              ["Command", LayoutDashboard],
              ["AI Newsroom", Bot],
              ["Media Intel", CloudLightning],
              ["Security", ShieldCheck],
              ["Archive", Archive],
            ].map(([label, Icon], index) => (
              <a
                className={`orbit-nav-link ${index === 0 ? "is-active" : ""}`}
                href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
                key={label}
              >
                <Icon size={18} />
                <span>{label}</span>
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="orbit-kicker">Release Channel</p>
            <div className="mt-3 grid gap-3">
              {releaseState.map((item) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={item.label}
                >
                  <span className="text-xs font-semibold text-zinc-500">
                    {item.label}
                  </span>
                  <span className={`text-xs font-black ${item.tone}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

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
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="grid gap-4">
              <section className="orbit-hero" id="command">
                <div className="relative z-10 max-w-3xl">
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    {releaseState.map((item) => (
                      <span className="orbit-release-pill" key={item.label}>
                        {item.label}:{" "}
                        <strong className={item.tone}>{item.value}</strong>
                      </span>
                    ))}
                  </div>

                  <p className="orbit-kicker">AI Media Production Suite</p>
                  <h3 className="mt-3 max-w-2xl text-4xl font-black leading-[1.02] text-white md:text-6xl">
                    BLACK FLASH ORBIT Command Center
                  </h3>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 md:text-base">
                    Dashboard operasional untuk redaksi AI, transkrip audio,
                    arsip berita, kontrol admin, dan produksi multimedia
                    modern.
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button className="orbit-primary-button">
                      <Activity size={18} />
                      Start Editorial Pulse
                    </button>
                    <button className="orbit-secondary-button">
                      <BarChart3 size={18} />
                      View System Report
                    </button>
                  </div>
                </div>

                <div className="orbit-radar" aria-label="Live newsroom radar">
                  <span className="orbit-radar-ring" />
                  <span className="orbit-radar-ring delay-1" />
                  <span className="orbit-radar-ring delay-2" />
                  <div className="relative z-10 text-center">
                    <CircleDot className="mx-auto text-emerald-300" size={44} />
                    <p className="mt-4 text-xs font-black uppercase text-amber-200">
                      Live Signal
                    </p>
                    <p className="mt-1 text-3xl font-black text-white">24/7</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {commandStats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article className="orbit-card" key={stat.label}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase text-zinc-500">
                            {stat.label}
                          </p>
                          <p className="mt-3 text-3xl font-black text-white">
                            {stat.value}
                          </p>
                        </div>
                        <div className="grid size-11 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
                          <Icon size={21} />
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-zinc-400">
                        {stat.detail}
                      </p>
                    </article>
                  );
                })}
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <article className="orbit-panel" id="ai-newsroom">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="orbit-kicker">Newsroom Pipeline</p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Editorial production flow
                      </h3>
                    </div>
                    <Newspaper className="text-amber-200" size={26} />
                  </div>

                  <div className="mt-6 grid gap-3">
                    {newsroomFlow.map((step) => {
                      const Icon = step.icon;

                      return (
                        <div className="orbit-flow-row" key={step.title}>
                          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-amber-200">
                            <Icon size={19} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="font-black text-white">
                                {step.title}
                              </h4>
                              <span className="text-xs font-black text-amber-200">
                                {step.progress}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-zinc-400">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="orbit-panel" id="media-intel">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="orbit-kicker">AI Modules</p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Production engines
                      </h3>
                    </div>
                    <Bot className="text-amber-200" size={26} />
                  </div>

                  <div className="mt-6 grid gap-3">
                    {aiModules.map((module) => {
                      const Icon = module.icon;

                      return (
                        <div className="orbit-module-row" key={module.name}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid size-10 place-items-center rounded-lg bg-[#7d1f2f]/40 text-rose-100">
                              <Icon size={19} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-black text-white">
                                {module.name}
                              </p>
                              <p className="text-xs font-semibold text-zinc-500">
                                {module.state}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="text-zinc-600" size={18} />
                        </div>
                      );
                    })}
                  </div>
                </article>
              </section>
            </section>

            <aside className="grid content-start gap-4">
              <section className="orbit-panel" id="security">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="orbit-kicker">Secure Operations</p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Admin guardrail
                    </h3>
                  </div>
                  <ShieldCheck className="text-emerald-300" size={28} />
                </div>

                <div className="mt-6 grid gap-3">
                  {securitySignals.map((signal) => {
                    const Icon = signal.icon;

                    return (
                      <div className="orbit-signal" key={signal.label}>
                        <div className="flex items-center gap-3">
                          <Icon size={18} />
                          <span>{signal.label}</span>
                        </div>
                        <strong>{signal.value}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="orbit-panel" id="archive">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="orbit-kicker">Live Brief</p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Editorial queue
                    </h3>
                  </div>
                  <FileText className="text-amber-200" size={27} />
                </div>

                <div className="mt-6 grid gap-3">
                  {liveBriefs.map((brief) => (
                    <article className="orbit-brief" key={brief.title}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase text-amber-200">
                          {brief.desk}
                        </p>
                        <span className="text-xs font-bold text-zinc-500">
                          {brief.time}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {brief.title}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
