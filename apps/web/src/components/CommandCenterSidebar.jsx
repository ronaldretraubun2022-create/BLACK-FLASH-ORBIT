import {
  Archive,
  Bot,
  CloudLightning,
  Command,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

const navigationItems = [
  ["Command", LayoutDashboard],
  ["AI Newsroom", Bot],
  ["Media Intel", CloudLightning],
  ["Security", ShieldCheck],
  ["Archive", Archive],
];

export function CommandCenterSidebar({ releaseState }) {
  return (
    <aside className="orbit-sidebar">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-lg border border-amber-300/30 bg-amber-300 text-black shadow-[0_0_40px_rgba(217,173,87,0.22)]">
          <Command size={22} />
        </div>
        <div>
          <p className="orbit-kicker">BLACK FLASH</p>
          <h1 className="text-lg font-black leading-tight text-white">ORBIT</h1>
        </div>
      </div>

      <nav className="mt-8 grid gap-2">
        {navigationItems.map(([label, Icon], index) => (
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
  );
}
