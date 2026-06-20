import {
  Archive,
  Bot,
  CloudLightning,
  Command,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

const adminRoles = new Set(["admin", "owner", "super_admin"]);

const navigationItems = [
  ["Command", LayoutDashboard, "all"],
  ["AI Newsroom", Bot, "all"],
  ["Media Intel", CloudLightning, "all"],
  ["Security", ShieldCheck, "admin"],
  ["Archive", Archive, "all"],
];

function isAdminRole(role) {
  return adminRoles.has(String(role || "").toLowerCase());
}

export function CommandCenterSidebar({ releaseState = [], userRole = "user" }) {
  const visibleNavigationItems = navigationItems.filter(
    ([, , access]) => access === "all" || isAdminRole(userRole),
  );

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

      <div className="mt-5 rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
          Access Role
        </p>
        <p className="mt-1 text-sm font-black uppercase text-white">
          {userRole}
        </p>
      </div>

      <nav className="mt-6 grid gap-2">
        {visibleNavigationItems.map(([label, Icon], index) => (
          <a
            className={`orbit-nav-link ${index === 0 ? "is-active" : ""}`}
            href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
            key={label}>
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
              key={item.label}>
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
