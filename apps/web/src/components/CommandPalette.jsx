import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bot,
  Command,
  FileText,
  Globe2,
  LayoutDashboard,
  Search,
  Sparkles,
} from "lucide-react";

export function CommandPalette({ commands = [], isOpen, onClose, onSelect }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return commands;

    return commands.filter((command) => {
      const haystack = [
        command.label,
        command.description,
        ...(command.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [commands, query]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((current) =>
      filteredCommands.length === 0
        ? 0
        : Math.min(current, filteredCommands.length - 1),
    );
  }, [filteredCommands.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (!filteredCommands.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filteredCommands.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (current) =>
            (current - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const command = filteredCommands[activeIndex];
        if (command) onSelect(command);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredCommands, isOpen, onClose, onSelect]);

  function handleSelect(command) {
    onSelect(command);
  }

  if (!isOpen) return null;

  return (
    <div className="orbit-palette-layer" role="presentation">
      <button
        aria-label="Close command palette"
        className="orbit-palette-overlay"
        onClick={onClose}
        type="button"
      />

      <section
        aria-label="Command Palette"
        aria-modal="true"
        className="orbit-palette"
        role="dialog">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Command size={18} />
          </div>

          <div className="min-w-0">
            <p className="orbit-kicker">Command Palette</p>
            <h2 className="truncate text-sm font-black text-white">
              Search commands
            </h2>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <label className="orbit-palette-search">
            <Search size={16} />
            <input
              aria-label="Search commands"
              autoComplete="off"
              className="orbit-palette-input"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                  return;
                }

                if (!filteredCommands.length) return;

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % filteredCommands.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(
                    (current) =>
                      (current - 1 + filteredCommands.length) % filteredCommands.length,
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const command = filteredCommands[activeIndex];
                  if (command) handleSelect(command);
                }
              }}
              placeholder="Type a command..."
              ref={inputRef}
              value={query}
            />
          </label>
        </div>

        <div className="max-h-[min(62vh,28rem)] overflow-y-auto p-2">
          {filteredCommands.length ? (
            <div className="grid gap-1">
              {filteredCommands.map((command, index) => {
                const Icon = command.icon || LayoutDashboard;
                const isActive = index === activeIndex;

                return (
                  <button
                    className={`orbit-palette-item ${
                      isActive ? "is-active" : ""
                    }`}
                    key={command.id || command.label}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(command)}
                    type="button">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-black text-white">
                        {command.label}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {command.description}
                      </span>
                    </span>
                    {command.hotkey ? (
                      <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        {command.hotkey}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="orbit-empty-state mx-2 my-2 grid gap-2 px-4 py-6 text-center">
              <Sparkles className="mx-auto text-cyan-300" size={22} />
              <p className="text-sm font-bold text-white">No commands found</p>
              <p className="text-xs leading-6 text-zinc-500">
                Try another keyword or clear the search input.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
