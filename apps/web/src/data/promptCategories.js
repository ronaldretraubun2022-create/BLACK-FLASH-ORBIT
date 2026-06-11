export const ALL_PROMPT_CATEGORIES_LABEL = "Semua";

export const PROMPT_CATEGORIES = [
  "newsroom",
  "osint",
  "engineering",
  "security",
  "product",
  "audit",
  "codex",
  "backend",
  "frontend",
  "database",
  "supabase",
  "automation",
  "monitoring",
  "reports",
  "ai",
  "devops",
];

export function normalizePromptCategory(value, fallback = "newsroom") {
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();

  return normalized || fallback;
}

export function buildPromptCategoryOptions(categories = []) {
  const defaultCategorySet = new Set(PROMPT_CATEGORIES);
  const extraCategories = new Set();

  categories
    .map((category) => normalizePromptCategory(category, ""))
    .filter(Boolean)
    .filter((category) => !defaultCategorySet.has(category))
    .forEach((category) => extraCategories.add(category));

  return [
    ALL_PROMPT_CATEGORIES_LABEL,
    ...PROMPT_CATEGORIES,
    ...Array.from(extraCategories).sort(),
  ];
}
