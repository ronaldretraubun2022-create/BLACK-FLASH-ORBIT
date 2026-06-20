import { FileText, ShieldCheck } from "lucide-react";

export function CommandCenterActivityPanel({ liveBriefItems, securityItems }) {
  return (
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
          {securityItems.map((signal) => {
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
          {liveBriefItems.map((brief) => (
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
  );
}
