import {
  Activity,
  Bot,
  FileText,
  LayoutDashboard,
  RadioTower,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", href: "#dashboard", icon: LayoutDashboard },
  { label: "AI Workspace", href: "#ai-workspace", icon: Bot },
  { label: "Monitoring", href: "#monitoring", icon: Activity },
  { label: "Security", href: "#security", icon: ShieldCheck },
  { label: "Reports", href: "#reports", icon: FileText },
  { label: "Settings", href: "#settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <button
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        type="button"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#070b14]/95 px-5 py-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <a className="flex items-center gap-3" href="#dashboard" onClick={onClose}>
            <span className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
              <RadioTower size={20} />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.18em] text-white">
                BLACK FLASH
              </span>
              <span className="block text-[10px] font-bold tracking-[0.45em] text-cyan-300">
                ORBIT
              </span>
            </span>
          </a>

          <button
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-10 text-[10px] font-bold tracking-[0.24em] text-slate-500">
          COMMAND CENTER
        </div>

        <nav className="mt-4 grid gap-1.5" aria-label="Main navigation">
          {navigation.map(({ label, href, icon: Icon }, index) => (
            <a
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                index === 0
                  ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                  : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
              }`}
              href={href}
              key={href}
              onClick={onClose}
            >
              <Icon size={17} />
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-cyan-300">
            <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_16px_#67e8f9]" />
            SECURE CHANNEL
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Dashboard operations protected by ORBIT monitoring.
          </p>
        </div>
      </aside>
    </>
  );
}
