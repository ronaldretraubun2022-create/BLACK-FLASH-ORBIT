import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Library, Loader2, Search } from "lucide-react";
import {
  ALL_PROMPT_CATEGORIES_LABEL,
  buildPromptCategoryOptions,
  normalizePromptCategory,
} from "../data/promptCategories";
import { getAuthenticatedHeaders } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function PromptLibrary({ onSelectTemplate }) {
  const [prompts, setPrompts] = useState([]);
  const [serverCategories, setServerCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    ALL_PROMPT_CATEGORIES_LABEL,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPrompts() {
      try {
        setIsLoading(true);
        setError("");

        const headers = {
          Accept: "application/json",
          ...(await getAuthenticatedHeaders()),
        };
        const [promptsResponse, categoriesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/prompts`, { headers }),
          fetch(`${API_BASE_URL}/api/v1/prompts/categories`, { headers }),
        ]);

        if (!promptsResponse.ok) {
          throw new Error(`Gagal memuat prompts: ${promptsResponse.status}`);
        }

        const [promptsData, categoriesData] = await Promise.all([
          promptsResponse.json(),
          categoriesResponse.ok ? categoriesResponse.json() : null,
        ]);

        setServerCategories(
          Array.isArray(categoriesData?.data)
            ? categoriesData.data.map((category) =>
                normalizePromptCategory(category),
              )
            : [],
        );
        setPrompts(
          Array.isArray(promptsData)
            ? promptsData.map((prompt) => ({
                ...prompt,
                category: normalizePromptCategory(prompt.category),
              }))
            : [],
        );
      } catch (loadError) {
        setError(loadError.message || "Gagal memuat prompt library.");
        setPrompts([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadPrompts();
  }, []);

  const categories = useMemo(() => {
    return buildPromptCategoryOptions(
      [
        ...serverCategories,
        ...prompts.map((prompt) => prompt.category).filter(Boolean),
      ],
    );
  }, [prompts, serverCategories]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return prompts.filter((template) => {
      const content = template.content || template.prompt || "";
      const matchesCategory =
        selectedCategory === ALL_PROMPT_CATEGORIES_LABEL ||
        normalizePromptCategory(template.category) === selectedCategory;
      const matchesSearch =
        !query ||
        [template.title, template.category, content]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [prompts, searchQuery, selectedCategory]);

  function handleSelectTemplate(template) {
    if (typeof onSelectTemplate === "function") {
      onSelectTemplate({
        id: template.id,
        title: template.title || "Prompt Template",
        category: normalizePromptCategory(template.category),
        content: template.content || template.prompt || "",
      });
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
          value={selectedCategory}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs font-bold text-slate-400">
            <Loader2 className="animate-spin text-cyan-300" size={16} />
            Memuat prompt dari Supabase...
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-xs leading-5 text-rose-200">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!isLoading &&
          !error &&
          filteredTemplates.map((template) => {
            const content = template.content || template.prompt || "";

            return (
              <button
                className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                type="button">
                <h4 className="line-clamp-1 text-sm font-black text-white">
                  {template.title}
                </h4>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  {template.category}
                </p>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                  {content}
                </p>
              </button>
            );
          })}

        {!isLoading && !error && filteredTemplates.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
            Template tidak ditemukan.
          </p>
        )}
      </div>
    </section>
  );
}
