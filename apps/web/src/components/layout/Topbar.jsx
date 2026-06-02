import { useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function Topbar({ onMenuClick }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060a12]/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          aria-label="Open navigation"
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200 lg:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <Menu size={19} />
        </button>

        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
            ORBIT INTELLIGENCE
          </p>
          <h1 className="text-sm font-bold text-white sm:text-base">
            Newsroom Command Dashboard
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            aria-label="Search"
            className="hidden rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition hover:text-white sm:block"
            type="button"
          >
            <Search size={18} />
          </button>
          <button
            aria-label="Notifications"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition hover:text-white"
            type="button"
          >
            <Bell size={18} />
          </button>
          <div className="ml-1 hidden min-w-0 items-center gap-3 sm:flex">
            <div className="min-w-0 text-right">
              <p className="max-w-44 truncate text-xs font-bold text-slate-200">
                {user?.email || "Authenticated User"}
              </p>
              <p className="text-[10px] font-black tracking-[0.16em] text-cyan-300">
                OPERATOR
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-200">
              {user?.email?.slice(0, 2).toUpperCase() || "BF"}
            </div>
          </div>
          <button
            aria-label="Logout"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition hover:border-rose-300/30 hover:text-rose-200"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
