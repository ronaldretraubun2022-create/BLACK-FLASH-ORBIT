import { useMemo, useState } from "react";
import { Library, Search } from "lucide-react";
import { promptTemplates } from "../data/promptTemplates";

const ALL_CATEGORIES = "Semua";

export function PromptLibrary({ onSelectTemplate }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);

  const categories = useMemo(() => {
    const categorySet = new Set(
      promptTemplates.map((template) => template.category).filter(Boolean),
    );

    return [ALL_CATEGORIES, ...Array.from(categorySet).sort()];
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return promptTemplates.filter((template) => {
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES ||
        template.category === selectedCategory;
      const matchesSearch =
        !query ||
        [template.title, template.category, template.prompt]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  function handleSelectTemplate(template) {
    if (typeof onSelectTemplate === "function") {
      onSelectTemplate(template.prompt);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center gap-2">
        <Library className="text-cyan-300" size={18} />
        <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
          PROMPT LIBRARY
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
          <Search size={15} />
          <input
            className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari template..."
            value={searchQuery}
          />
        </label>

        <select
          className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-xs font-bold text-slate-100 outline-none transition focus:border-cyan-300/40"
          onChange={(event) => setSelectedCategory(event.target.value)}
          value={selectedCategory}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
        {filteredTemplates.map((template) => (
          <button
            className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            type="button"
          >
            <h4 className="line-clamp-1 text-sm font-black text-white">
              {template.title}
            </h4>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
              {template.category}
            </p>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
              {template.prompt}
            </p>
          </button>
        ))}

        {filteredTemplates.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
            Template tidak ditemukan.
          </p>
        )}
      </div>
    </section>
  );
}
