import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  FileCode2,
  Globe2,
  Layers3,
  Loader2,
  Plus,
  GripVertical,
  RefreshCcw,
  Rocket,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { useProfile } from "../hooks/useProfile.js";
import { api } from "../services/api.js";

const releaseState = [
  { label: "Module", value: "web-builder", tone: "text-amber-300" },
  { label: "API", value: "v1", tone: "text-white" },
  { label: "Auth", value: "required", tone: "text-emerald-300" },
];

const emptyProjectForm = {
  description: "",
  slug: "",
  title: "",
};

const emptyPageForm = {
  path: "/",
  title: "",
};

const AUTO_REFRESH_MS = 30000;
const SECTION_AUTOSAVE_DELAY_MS = 700;
const SECTION_HISTORY_LIMIT = 60;
const autosaveStatusConfig = {
  failed: { label: "Save failed", tone: "red" },
  saved: { label: "Saved", tone: "green" },
  saving: { label: "Saving...", tone: "amber" },
  unsaved: { label: "Unsaved changes", tone: "amber" },
};
const previewViewports = {
  desktop: {
    icon: Monitor,
    label: "Desktop",
    width: "100%",
    maxWidth: "100%",
  },
  tablet: {
    icon: Tablet,
    label: "Tablet",
    width: "768px",
    maxWidth: "100%",
  },
  mobile: {
    icon: Smartphone,
    label: "Mobile",
    width: "390px",
    maxWidth: "100%",
  },
};

const componentLibrary = [
  {
    id: "hero",
    label: "Hero",
    type: "hero",
    summary: "Lead visual untuk headline utama dan ringkasan editorial.",
    props: {
      label: "Papua Selatan Today",
      title: "Newsroom intelligence for regional multimedia coverage",
      body: "Dashboard publikasi untuk berita cepat, visual lapangan, dan arsip editorial.",
      actionLabel: "Baca laporan utama",
    },
  },
  {
    id: "navbar",
    label: "Navbar",
    type: "text",
    summary: "Navigasi brand dan kanal utama media.",
    props: {
      label: "ORBIT News",
      title: "BLACK FLASH ORBIT",
      body: "Beranda / Berita / Multimedia / Arsip",
    },
  },
  {
    id: "footer",
    label: "Footer",
    type: "text",
    summary: "Penutup situs dengan identitas redaksi dan kanal kontak.",
    props: {
      label: "Footer",
      title: "BLACK FLASH ORBIT",
      body: "Editorial desk, multimedia archive, and secure newsroom operations.",
    },
  },
  {
    id: "card",
    label: "Card",
    type: "feature-grid",
    summary: "Kartu modular untuk highlight data, program, atau layanan.",
    props: {
      label: "Highlights",
      title: "Editorial command cards",
      body: "Ringkasan modul siap pakai untuk project newsroom.",
      items: ["Breaking Desk", "Fact Check", "Media Archive"],
    },
  },
  {
    id: "gallery",
    label: "Gallery",
    type: "gallery",
    summary: "Grid visual untuk foto lapangan dan aset multimedia.",
    props: {
      label: "Gallery",
      title: "Field visuals",
      body: "Kurasi foto, video still, dan dokumentasi lapangan.",
      items: ["Jayapura Desk", "Merauke Field", "Asmat Archive"],
    },
  },
  {
    id: "news-grid",
    label: "News Grid",
    type: "article-list",
    summary: "Grid artikel untuk headline, ringkasan, dan kanal berita.",
    props: {
      label: "Latest News",
      title: "Top newsroom updates",
      body: "Daftar berita utama untuk halaman depan.",
      items: [
        "Agenda pemerintahan daerah",
        "Kabar ekonomi masyarakat",
        "Liputan multimedia lapangan",
      ],
    },
  },
  {
    id: "cta",
    label: "CTA",
    type: "cta",
    summary: "Ajakan aksi untuk langganan, kontak redaksi, atau arsip.",
    props: {
      label: "CTA",
      title: "Siapkan paket publikasi berikutnya",
      body: "Kirim draft, aset visual, dan metadata agar editor dapat meninjau paket berita.",
      actionLabel: "Mulai kurasi",
    },
  },
];

const defaultComponentIds = componentLibrary.map((component) => component.id);
const componentIdSet = new Set(defaultComponentIds);

function getResponseData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function getErrorMessage(error, fallback = "Request Web Builder gagal.") {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeSlugInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validateProjectForm(form) {
  const title = form.title.trim();
  const slug = form.slug.trim();

  if (!title) return "Title project wajib diisi.";
  if (title.length > 160) return "Title project maksimal 160 karakter.";
  if (form.description.length > 800) {
    return "Description project maksimal 800 karakter.";
  }
  if (slug && !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    return "Slug hanya boleh huruf kecil, angka, dan tanda hubung.";
  }

  return "";
}

function validatePageForm(form) {
  const title = form.title.trim();
  const path = form.path.trim();

  if (!title) return "Title halaman wajib diisi.";
  if (title.length > 160) return "Title halaman maksimal 160 karakter.";
  if (path.length > 120) return "Path halaman maksimal 120 karakter.";
  if (path !== "/" && !/^\/?[a-z0-9][a-z0-9/_-]*$/.test(path)) {
    return "Path halaman hanya boleh huruf kecil, angka, garis miring, underscore, dan tanda hubung.";
  }

  return "";
}

function createProjectPayload(form) {
  const payload = {
    title: form.title.trim(),
  };
  const description = form.description.trim();
  const slug = normalizeSlugInput(form.slug);

  if (description) payload.description = description;
  if (slug) payload.slug = slug;

  return payload;
}

function getSelectedComponents(componentIds = defaultComponentIds) {
  const selectedIds = componentIds.filter((componentId) =>
    componentIdSet.has(componentId),
  );
  const activeIds = selectedIds.length ? selectedIds : defaultComponentIds;

  return activeIds
    .map((componentId) =>
      componentLibrary.find((component) => component.id === componentId),
    )
    .filter(Boolean);
}

function createComponentSection(component, index) {
  return {
    id: `${component.id}-${index + 1}`,
    type: component.type,
    props: { ...component.props },
    styles: {
      component: component.id,
    },
  };
}

function buildComponentSections(componentIds = defaultComponentIds) {
  return getSelectedComponents(componentIds).map(createComponentSection);
}

function createDraftSection(componentId) {
  const component = componentLibrary.find((item) => item.id === componentId);

  if (!component) return null;

  return {
    ...createComponentSection(component, 0),
    id: `${component.id}-${Date.now().toString(36)}`,
  };
}

function cloneSectionForPayload(section, index) {
  return {
    id: section.id || `section-${index + 1}`,
    type: section.type,
    props: { ...(section.props || {}) },
    styles: { ...(section.styles || {}) },
  };
}

function cloneSectionsForDraft(sections) {
  if (!Array.isArray(sections) || !sections.length) return [];

  return sections.map((section, index) => cloneSectionForPayload(section, index));
}

function getSectionComponentIds(sections) {
  return sections
    .map((section) => section?.styles?.component)
    .filter((componentId) => componentIdSet.has(componentId));
}

function getSectionsSignature(sections) {
  try {
    return JSON.stringify(cloneSectionsForDraft(sections));
  } catch {
    return "[]";
  }
}

function getAutosaveStatusConfig(status) {
  return autosaveStatusConfig[status] || autosaveStatusConfig.saved;
}

function limitSectionHistory(items) {
  return items.slice(-SECTION_HISTORY_LIMIT);
}

function syncPageSections(pages, pageId, sections) {
  const nextSections = cloneSectionsForDraft(sections);

  return pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          metadata: {
            ...(page.metadata || {}),
            componentLibrary: getSectionComponentIds(nextSections),
          },
          sections: nextSections,
        }
      : page,
  );
}

function createPageSectionsPatch(page, sections) {
  const nextSections = cloneSectionsForDraft(sections);

  return {
    metadata: {
      ...(page?.metadata || {}),
      componentLibrary: getSectionComponentIds(nextSections),
    },
    sections: nextSections,
  };
}

function createPagePayload(form, sections = buildComponentSections()) {
  const path = form.path.trim() || "/";
  const activeSections = Array.isArray(sections) ? sections : [];

  return {
    metadata: {
      componentLibrary: getSectionComponentIds(activeSections),
    },
    path: path.startsWith("/") ? path : `/${path}`,
    sections: activeSections.map(cloneSectionForPayload),
    title: form.title.trim(),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPreviewPages(projectDetail, projectForm, pageForm, selectedProjectId) {
  if (projectDetail?.pages?.length) return projectDetail.pages;

  if (!selectedProjectId) return [];

  const fallbackPage = {
    id: "preview-page",
    path: pageForm.path || "/",
    sections: [],
    sortOrder: 0,
    title: pageForm.title || "Home",
  };

  return [fallbackPage];
}

function getSectionItems(props, fallbackItems = []) {
  if (Array.isArray(props.items) && props.items.length) {
    return props.items.slice(0, 4);
  }

  return fallbackItems;
}

function renderPreviewSection(section) {
  const props = section?.props || {};
  const component = section?.styles?.component || section?.id || section?.type;
  const label = escapeHtml(props.label || component || "Component");
  const title = escapeHtml(props.title || props.heading || "Untitled");
  const body = escapeHtml(props.body || props.content || props.text || "");
  const actionLabel = escapeHtml(props.actionLabel || "Open");

  if (component === "navbar") {
    return `<nav class="component component-nav"><strong>${title}</strong><span>${body}</span></nav>`;
  }

  if (component === "footer") {
    return `<footer class="component component-footer"><strong>${title}</strong><span>${body}</span></footer>`;
  }

  if (section?.type === "hero") {
    return `<section class="component component-hero"><div><p>${label}</p><h2>${title}</h2><span>${body}</span></div><a>${actionLabel}</a></section>`;
  }

  if (section?.type === "gallery") {
    const items = getSectionItems(props, ["Frame 01", "Frame 02", "Frame 03"]);
    const itemMarkup = items
      .map(
        (item, index) =>
          `<figure><div>${String(index + 1).padStart(2, "0")}</div><figcaption>${escapeHtml(item)}</figcaption></figure>`,
      )
      .join("");

    return `<section class="component"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="gallery-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "article-list") {
    const items = getSectionItems(props, [
      "Lead berita utama",
      "Update redaksi",
      "Arsip multimedia",
    ]);
    const itemMarkup = items
      .map(
        (item) =>
          `<article><p>Newsroom</p><h3>${escapeHtml(item)}</h3><span>Ringkasan berita siap publikasi.</span></article>`,
      )
      .join("");

    return `<section class="component"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="news-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "feature-grid") {
    const items = getSectionItems(props, ["Editorial", "Multimedia", "Archive"]);
    const itemMarkup = items
      .map(
        (item) =>
          `<article><strong>${escapeHtml(item)}</strong><span>Reusable content block.</span></article>`,
      )
      .join("");

    return `<section class="component"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span><div class="card-grid">${itemMarkup}</div></section>`;
  }

  if (section?.type === "cta") {
    return `<section class="component component-cta"><div><p>${label}</p><h2>${title}</h2><span>${body}</span></div><a>${actionLabel}</a></section>`;
  }

  return `<section class="component"><p class="component-label">${label}</p><h2>${title}</h2><span>${body}</span></section>`;
}

function buildPreviewHtml({
  componentSections,
  page,
  previewMode,
  project,
  projectForm,
  pageForm,
}) {
  const resolvedTitle =
    project?.title || projectForm.title || "Web Builder Preview";
  const resolvedDescription =
    project?.description ||
    projectForm.description ||
    "Realtime preview from existing Web Builder state.";
  const fallbackPages = getPreviewPages(
    project,
    projectForm,
    pageForm,
    project?.id,
  );
  const activeSections = Array.isArray(page?.sections) && page.sections.length
    ? page.sections
    : componentSections;
  const pages = Array.isArray(project?.pages) && project.pages.length
    ? project.pages.slice(0, 4)
    : (fallbackPages.length ? fallbackPages : [page])
        .filter(Boolean)
        .slice(0, 4);
  const sectionMarkup = (activeSections || []).map(renderPreviewSection).join("");
  const pageMarkup = pages
    .map(
      (item) => `
        <article class="page-card">
          <div class="page-path">${escapeHtml(item.path || "/")}</div>
          <h3>${escapeHtml(item.title || "Page")}</h3>
          <p>${escapeHtml(
            item.sections?.length ? `${item.sections.length} sections ready` : "Empty page skeleton",
          )}</p>
        </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050506;
      --panel: rgba(255,255,255,0.04);
      --line: rgba(255,255,255,0.12);
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #f5c14b;
      --accent-strong: #d9ad57;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(217,173,87,0.18), transparent 28%),
        linear-gradient(180deg, #0a0a0b, var(--bg));
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .shell {
      padding: 20px;
      max-width: ${previewMode === "mobile" ? "390px" : previewMode === "tablet" ? "768px" : "1200px"};
      margin: 0 auto;
    }
    .hero, .page-card {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 18px;
      backdrop-filter: blur(14px);
    }
    .hero { padding: 20px; }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      font-weight: 800;
    }
    h1 { margin: 12px 0 8px; font-size: 32px; line-height: 1.05; }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
    .meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text);
      background: rgba(0,0,0,0.22);
    }
    .grid {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
    .page-card { padding: 14px; }
    .page-path {
      font-size: 11px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-weight: 800;
    }
    .page-card h3 {
      margin: 10px 0 6px;
      font-size: 18px;
      line-height: 1.2;
    }
    .section-title {
      margin: 18px 0 10px;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }
    .component {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,0.035);
      padding: 16px;
    }
    .component h2 {
      margin: 8px 0 8px;
      font-size: 24px;
      line-height: 1.12;
    }
    .component span,
    .component article span,
    figcaption {
      color: var(--muted);
      line-height: 1.5;
    }
    .component-label,
    .component-hero p,
    .component-cta p {
      margin: 0;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .component-nav,
    .component-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-radius: 16px;
    }
    .component-nav strong,
    .component-footer strong {
      color: var(--text);
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .component-hero,
    .component-cta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, rgba(245,193,75,0.16), rgba(255,255,255,0.04));
    }
    .component-hero a,
    .component-cta a {
      border-radius: 999px;
      background: var(--accent);
      color: #080808;
      font-size: 12px;
      font-weight: 900;
      padding: 10px 14px;
      text-decoration: none;
      white-space: nowrap;
    }
    .card-grid,
    .gallery-grid,
    .news-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .card-grid article,
    .news-grid article,
    .gallery-grid figure {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(0,0,0,0.22);
      padding: 12px;
    }
    .card-grid strong,
    .news-grid h3 {
      display: block;
      margin: 0 0 6px;
      color: var(--text);
      font-size: 15px;
    }
    .news-grid p {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .gallery-grid figure div {
      display: grid;
      min-height: 92px;
      place-items: center;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(217,173,87,0.32), rgba(128,0,32,0.34));
      color: var(--text);
      font-weight: 900;
    }
    .gallery-grid figcaption {
      display: block;
      margin-top: 10px;
      font-size: 13px;
    }
    @media (max-width: 520px) {
      .component-nav,
      .component-footer,
      .component-hero,
      .component-cta {
        grid-template-columns: 1fr;
        align-items: start;
      }
      .component-nav,
      .component-footer {
        display: grid;
      }
      .component-hero a,
      .component-cta a {
        width: fit-content;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">Live Preview</div>
      <h1>${escapeHtml(resolvedTitle)}</h1>
      <p>${escapeHtml(resolvedDescription)}</p>
      <div class="meta">
        <span class="chip">Selected: ${escapeHtml(project?.slug || projectForm.slug || "draft")}</span>
        <span class="chip">Path: ${escapeHtml(page?.path || pageForm.path || "/")}</span>
        <span class="chip">Mode: ${escapeHtml(previewMode)}</span>
      </div>
    </section>

    <div class="section-title">Components</div>
    ${sectionMarkup || '<section class="component"><h2>No components selected</h2><span>Select a component from the library.</span></section>'}

    <div class="section-title">Pages</div>
    <section class="grid">
      ${pageMarkup || '<article class="page-card"><h3>No pages yet</h3><p>Add a page to render the live preview.</p></article>'}
    </section>
  </main>
</body>
</html>`;
}

function WebBuilderStat({ label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <strong className="mt-2 block text-2xl font-black text-white">
        {value}
      </strong>
    </article>
  );
}

function StatusPill({ children, tone = "amber" }) {
  const toneClass =
    tone === "red"
      ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
      : tone === "green"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : "border-amber-300/25 bg-amber-300/10 text-amber-200";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${toneClass}`}>
      {children}
    </span>
  );
}

function WebBuilderEmptyState({ children, title }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-6 text-zinc-500">
      <h3 className="font-black text-zinc-200">{title}</h3>
      <p className="mt-2">{children}</p>
    </div>
  );
}

function WebBuilderLoading() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
          key={item}
        />
      ))}
    </div>
  );
}

export function WebBuilder() {
  const { profile } = useProfile();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [pageForm, setPageForm] = useState(emptyPageForm);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSync, setLastSync] = useState("-");
  const [lastExport, setLastExport] = useState(null);
  const [draggedSectionId, setDraggedSectionId] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [draftSections, setDraftSections] = useState(() =>
    buildComponentSections(),
  );
  const [sectionHistory, setSectionHistory] = useState({
    future: [],
    past: [],
  });
  const [autosaveStatus, setAutosaveStatus] = useState("saved");
  const [activeSectionId, setActiveSectionId] = useState("hero-1");
  const [selectedPageId, setSelectedPageId] = useState("");
  const activeAutosavePromiseRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const draftPageIdRef = useRef("");
  const lastPersistedPageSectionsRef = useRef({
    pageId: "",
    signature: "",
  });

  const userRole = profile?.role || "user";

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError("");

    try {
      const data = await api.getWebBuilderProjects();
      const nextProjects = Array.isArray(data) ? data : [];

      setProjects(nextProjects);
      setSelectedProjectId((currentId) => {
        if (nextProjects.some((project) => project.id === currentId)) {
          return currentId;
        }

        return nextProjects[0]?.id || "";
      });
      setLastSync(new Date().toLocaleTimeString("id-ID"));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Gagal memuat project Web Builder."));
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadProjectDetail = useCallback(async (projectId) => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    setError("");

    try {
      const response = await api.getWebBuilderProject(projectId);
      setProjectDetail(getResponseData(response, null));
    } catch (loadError) {
      setProjectDetail(null);
      setError(getErrorMessage(loadError, "Gagal memuat detail Web Builder."));
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadProjectDetail(selectedProjectId);
  }, [loadProjectDetail, selectedProjectId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadProjects();
      if (selectedProjectId) {
        loadProjectDetail(selectedProjectId);
      }
      setPreviewRevision((current) => current + 1);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadProjectDetail, loadProjects, selectedProjectId]);

  const isProjectDetailCurrent = projectDetail?.id === selectedProjectId;
  const pages = useMemo(() => {
    const detailPages = isProjectDetailCurrent && Array.isArray(projectDetail?.pages)
      ? projectDetail.pages
      : [];

    if (!selectedPageId || draftPageIdRef.current !== selectedPageId) {
      return detailPages;
    }

    return syncPageSections(detailPages, selectedPageId, draftSections);
  }, [
    draftSections,
    isProjectDetailCurrent,
    projectDetail?.pages,
    selectedPageId,
  ]);
  const exportedProjects = projects.filter(
    (project) => project.status === "exported",
  ).length;
  const selectedProject =
    (isProjectDetailCurrent ? { ...projectDetail, pages } : null) ||
    projects.find((project) => project.id === selectedProjectId) ||
    null;
  const selectedPage = useMemo(() => {
    const detailPages = pages;

    if (!detailPages.length) return null;

    return (
      detailPages.find((page) => page.id === selectedPageId) ||
      detailPages[0] ||
      null
    );
  }, [pages, selectedPageId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedPageId("");
      draftPageIdRef.current = "";
      lastPersistedPageSectionsRef.current = {
        pageId: "",
        signature: "",
      };
      setSectionHistory({ future: [], past: [] });
      setAutosaveStatus("saved");
      setDraftSections(buildComponentSections());
      setActiveSectionId("hero-1");
      return;
    }

    if (!selectedPage) {
      setSelectedPageId("");
      draftPageIdRef.current = "";
      lastPersistedPageSectionsRef.current = {
        pageId: "",
        signature: "",
      };
      setSectionHistory({ future: [], past: [] });
      setAutosaveStatus("saved");
      setDraftSections(buildComponentSections());
      setActiveSectionId("hero-1");
      return;
    }

    if (selectedPage.id && selectedPageId !== selectedPage.id) {
      setSelectedPageId(selectedPage.id);
    }

    const persistedSections = cloneSectionsForDraft(selectedPage.sections);
    const nextSections = persistedSections;
    const safeSections = nextSections.length
      ? nextSections
      : buildComponentSections();

    draftPageIdRef.current = selectedPage.id || "";
    lastPersistedPageSectionsRef.current = {
      pageId: selectedPage.id || "",
      signature: getSectionsSignature(persistedSections),
    };
    setSectionHistory({ future: [], past: [] });
    setAutosaveStatus(
      getSectionsSignature(safeSections) === getSectionsSignature(persistedSections)
        ? "saved"
        : "unsaved",
    );
    setDraftSections(safeSections);
    setActiveSectionId((currentId) =>
      safeSections.some((section) => section.id === currentId)
        ? currentId
        : safeSections[0]?.id || "hero-1",
    );
  }, [selectedProjectId, selectedPage?.id]);

  useEffect(() => {
    if (
      !selectedProjectId ||
      !selectedPageId ||
      !selectedPage?.id ||
      draftPageIdRef.current !== selectedPageId
    ) {
      setAutosaveStatus("saved");
      return undefined;
    }

    const nextSections = cloneSectionsForDraft(draftSections);
    const nextSignature = getSectionsSignature(nextSections);
    const persisted = lastPersistedPageSectionsRef.current;

    if (
      persisted.pageId === selectedPageId &&
      persisted.signature === nextSignature
    ) {
      setAutosaveStatus("saved");
      return undefined;
    }

    setAutosaveStatus("unsaved");

    const timeoutId = window.setTimeout(async () => {
      autosaveTimeoutRef.current = null;
      saveCurrentPageSections().catch(() => {});
    }, SECTION_AUTOSAVE_DELAY_MS);

    autosaveTimeoutRef.current = timeoutId;

    return () => {
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }

      window.clearTimeout(timeoutId);
    };
  }, [
    draftSections,
    selectedPage?.id,
    selectedPage?.metadata,
    selectedPageId,
    selectedProjectId,
  ]);

  const canUndoSections = sectionHistory.past.length > 0;
  const canRedoSections = sectionHistory.future.length > 0;
  const autosaveStatusMeta = getAutosaveStatusConfig(autosaveStatus);

  useEffect(() => {
    function handleSectionHistoryShortcut(event) {
      const key = String(event.key || "").toLowerCase();
      const hasCommandKey = event.ctrlKey || event.metaKey;

      if (!hasCommandKey || event.altKey || event.defaultPrevented) return;

      const isUndo = key === "z" && !event.shiftKey;
      const isRedo =
        (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);

      if (isUndo && canUndoSections) {
        event.preventDefault();
        handleUndoSections();
      } else if (isRedo && canRedoSections) {
        event.preventDefault();
        handleRedoSections();
      }
    }

    window.addEventListener("keydown", handleSectionHistoryShortcut);

    return () =>
      window.removeEventListener("keydown", handleSectionHistoryShortcut);
  }, [canRedoSections, canUndoSections, draftSections, sectionHistory]);

  const dashboardStats = useMemo(
    () => [
      { label: "Projects", value: projects.length },
      { label: "Pages", value: pages.length },
      { label: "Exported", value: exportedProjects },
      { label: "Auth", value: "ON" },
    ],
    [exportedProjects, pages.length, projects.length],
  );

  const activeDraftSection =
    draftSections.find((section) => section.id === activeSectionId) ||
    draftSections[0] ||
    null;
  const activePreviewPage = {
    ...(selectedPage || {}),
    path: selectedPage?.path || pageForm.path || "/",
    sections: draftSections,
    title: selectedPage?.title || pageForm.title || "Home",
  };
  const previewHtml = useMemo(
    () =>
      buildPreviewHtml({
        componentSections: draftSections,
        page: activePreviewPage,
        previewMode,
        project: selectedProject,
        projectForm,
        pageForm,
      }),
    [
      activePreviewPage,
      pageForm,
      previewMode,
      projectForm,
      draftSections,
      selectedProject,
    ],
  );
  const previewFrame = previewViewports[previewMode];

  function syncPreview() {
    setPreviewRevision((current) => current + 1);
  }

  function commitDraftSections(nextSections, options = {}) {
    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const nextSnapshot = cloneSectionsForDraft(nextSections);

    if (getSectionsSignature(currentSnapshot) === getSectionsSignature(nextSnapshot)) {
      return false;
    }

    setSectionHistory((currentHistory) => ({
      future: [],
      past: limitSectionHistory([...currentHistory.past, currentSnapshot]),
    }));
    setDraftSections(nextSnapshot);

    if (options.activeSectionId !== undefined) {
      setActiveSectionId(options.activeSectionId);
    }

    setAutosaveStatus("unsaved");
    syncPreview();
    return true;
  }

  async function saveCurrentPageSections() {
    if (
      !selectedProjectId ||
      !selectedPageId ||
      !selectedPage?.id ||
      draftPageIdRef.current !== selectedPageId
    ) {
      setAutosaveStatus("saved");
      return false;
    }

    const activeSave = activeAutosavePromiseRef.current;

    if (activeSave) {
      await activeSave.catch(() => null);
    }

    const nextSections = cloneSectionsForDraft(draftSections);
    const nextSignature = getSectionsSignature(nextSections);
    const persisted = lastPersistedPageSectionsRef.current;

    if (
      persisted.pageId === selectedPageId &&
      persisted.signature === nextSignature
    ) {
      setAutosaveStatus("saved");
      return true;
    }

    setAutosaveStatus("saving");

    const savePromise = api.updateWebBuilderPage(
      selectedPageId,
      createPageSectionsPatch(selectedPage, nextSections),
    );

    activeAutosavePromiseRef.current = savePromise;

    try {
      await savePromise;
      lastPersistedPageSectionsRef.current = {
        pageId: selectedPageId,
        signature: nextSignature,
      };
      setLastSync(new Date().toLocaleTimeString("id-ID"));
      setAutosaveStatus("saved");
      return true;
    } catch (saveError) {
      setAutosaveStatus("failed");
      setError(getErrorMessage(saveError, "Gagal menyimpan section halaman."));
      throw saveError;
    } finally {
      if (activeAutosavePromiseRef.current === savePromise) {
        activeAutosavePromiseRef.current = null;
      }
    }
  }

  async function flushPendingAutosave() {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    const activeSave = activeAutosavePromiseRef.current;

    if (activeSave) {
      await activeSave.catch(() => null);
    }

    return saveCurrentPageSections();
  }

  function handleUndoSections() {
    if (!sectionHistory.past.length) return;

    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const previousSections =
      sectionHistory.past[sectionHistory.past.length - 1] || [];
    const nextSections = cloneSectionsForDraft(previousSections);

    setSectionHistory((currentHistory) => ({
      future: [currentSnapshot, ...currentHistory.future].slice(
        0,
        SECTION_HISTORY_LIMIT,
      ),
      past: currentHistory.past.slice(0, -1),
    }));
    setDraftSections(nextSections);
    setActiveSectionId((currentId) =>
      nextSections.some((section) => section.id === currentId)
        ? currentId
        : nextSections[0]?.id || "",
    );
    setAutosaveStatus("unsaved");
    syncPreview();
  }

  function handleRedoSections() {
    if (!sectionHistory.future.length) return;

    const currentSnapshot = cloneSectionsForDraft(draftSections);
    const nextSections = cloneSectionsForDraft(sectionHistory.future[0] || []);

    setSectionHistory((currentHistory) => ({
      future: currentHistory.future.slice(1),
      past: limitSectionHistory([...currentHistory.past, currentSnapshot]),
    }));
    setDraftSections(nextSections);
    setActiveSectionId((currentId) =>
      nextSections.some((section) => section.id === currentId)
        ? currentId
        : nextSections[0]?.id || "",
    );
    setAutosaveStatus("unsaved");
    syncPreview();
  }

  function handleAddSection(componentId) {
    const nextSection = createDraftSection(componentId);

    if (!nextSection) return;

    commitDraftSections([...draftSections, nextSection], {
      activeSectionId: nextSection.id,
    });
  }

  function handleEditSection(field, value) {
    if (!activeDraftSection) return;

    commitDraftSections(
      draftSections.map((section) =>
        section.id === activeDraftSection.id
          ? {
              ...section,
              props: {
                ...(section.props || {}),
                [field]: value,
              },
            }
          : section,
      ),
    );
  }

  function handleEditSectionItems(value) {
    if (!activeDraftSection) return;

    const items = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    commitDraftSections(
      draftSections.map((section) =>
        section.id === activeDraftSection.id
          ? {
              ...section,
              props: {
                ...(section.props || {}),
                items,
              },
            }
          : section,
      ),
    );
  }

  function handleDeleteSection(sectionId) {
    const nextSections = draftSections.filter(
      (section) => section.id !== sectionId,
    );
    const nextActiveSectionId =
      activeSectionId === sectionId ? nextSections[0]?.id || "" : activeSectionId;

    commitDraftSections(nextSections, {
      activeSectionId: nextActiveSectionId,
    });
  }

  function handleMoveSection(sectionId, direction) {
    const currentIndex = draftSections.findIndex(
      (section) => section.id === sectionId,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= draftSections.length
    ) {
      return;
    }

    const nextSections = [...draftSections];
    const [section] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, section);

    commitDraftSections(nextSections);
  }

  function handleDragStartSection(sectionId, event) {
    setDraggedSectionId(sectionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  }

  function handleDragEndSection() {
    setDraggedSectionId("");
  }

  function handleDropSection(targetSectionId) {
    const draggedIndex = draftSections.findIndex(
      (section) => section.id === draggedSectionId,
    );
    const targetIndex = draftSections.findIndex(
      (section) => section.id === targetSectionId,
    );

    if (draggedIndex >= 0 && targetIndex >= 0 && draggedIndex !== targetIndex) {
      const nextSections = [...draftSections];
      const [draggedSection] = nextSections.splice(draggedIndex, 1);
      const insertIndex =
        draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;

      nextSections.splice(insertIndex, 0, draggedSection);
      commitDraftSections(nextSections);
    }

    setDraggedSectionId("");
  }

  function handleDropSectionToEnd() {
    const draggedIndex = draftSections.findIndex(
      (section) => section.id === draggedSectionId,
    );

    if (draggedIndex >= 0 && draggedIndex !== draftSections.length - 1) {
      const nextSections = [...draftSections];
      const [draggedSection] = nextSections.splice(draggedIndex, 1);
      nextSections.push(draggedSection);
      commitDraftSections(nextSections);
    }

    setDraggedSectionId("");
  }

  async function handleCreateProject(event) {
    event.preventDefault();

    const validationError = validateProjectForm(projectForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreatingProject(true);
    setError("");
    setNotice("");

    try {
      const response = await api.createWebBuilderProject(
        createProjectPayload(projectForm),
      );
      const createdProject = getResponseData(response, null);

      setProjectForm(emptyProjectForm);
      setNotice("Project Web Builder berhasil dibuat.");
      await loadProjects();

      if (createdProject?.id) {
        setSelectedProjectId(createdProject.id);
      }
    } catch (createError) {
      setError(getErrorMessage(createError, "Gagal membuat project."));
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleCreatePage(event) {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Pilih project sebelum membuat halaman.");
      return;
    }

    const validationError = validatePageForm(pageForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreatingPage(true);
    setError("");
    setNotice("");

    try {
      const response = await api.createWebBuilderPage(
        selectedProjectId,
        createPagePayload(pageForm, draftSections),
      );
      const createdPage = getResponseData(response, null);
      setSelectedPageId(createdPage?.id || "");
      setPageForm(emptyPageForm);
      setNotice("Halaman Web Builder berhasil dibuat.");
      await loadProjectDetail(selectedProjectId);
    } catch (createError) {
      setError(getErrorMessage(createError, "Gagal membuat halaman."));
    } finally {
      setIsCreatingPage(false);
    }
  }

  async function handleExportProject() {
    if (!selectedProjectId) {
      setError("Pilih project sebelum export.");
      return;
    }

    setIsExporting(true);
    setError("");
    setNotice("");

    try {
      await flushPendingAutosave();

      const exported = {
        exportedAt: new Date().toISOString(),
        format: "orbit-web-builder-local-v1",
        html: previewHtml,
        pageId: selectedPage?.id || null,
        sectionCount: draftSections.length,
      };

      setLastExport(exported);
      setNotice("Export HTML berhasil dibuat dari draft lokal.");
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Gagal export project."));
    } finally {
      setIsExporting(false);
    }
  }

  function handleDownloadExport() {
    const html = previewHtml || lastExport?.html;

    if (!html) return;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${selectedProject?.slug || "orbit-web-builder"}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar releaseState={releaseState} userRole={userRole} />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Universal Web Builder</p>
              <h2 className="text-xl font-black text-white md:text-2xl">
                Project Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="orbit-icon-button"
                disabled={isLoadingProjects}
                onClick={loadProjects}
                type="button"
                title="Refresh Web Builder">
                <RefreshCcw
                  className={isLoadingProjects ? "animate-spin" : ""}
                  size={18}
                />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <section className="rounded-lg border border-amber-300/15 bg-[linear-gradient(135deg,_rgba(217,173,87,0.12),_rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-black/20 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-200">
                    <Globe2 size={23} />
                  </div>
                  <p className="mt-5 orbit-kicker">/api/v1/web-builder</p>
                  <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
                    Build newsroom web projects from protected backend data.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                    Dashboard ini memakai kontrak backend Web Builder yang sudah
                    ada: project CRUD, page CRUD, owner auth, dan export HTML.
                  </p>
                </div>

                <div className="grid content-start gap-3">
                  <StatusPill tone="green">Bearer Auth Active</StatusPill>
                  <StatusLine label="Last Sync" value={lastSync} />
                  <StatusLine
                    label="Selected"
                    value={selectedProject?.title || "-"}
                  />
                  <StatusLine
                    label="Export"
                    value={lastExport?.exportedAt ? "ready" : "not generated"}
                  />
                </div>
              </div>
            </section>

            {(error || notice) && (
              <section
                aria-live="polite"
                className={`rounded-lg border p-4 text-sm font-bold ${
                  error
                    ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
                    : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                }`}>
                <div className="flex gap-2">
                  {error ? <AlertTriangle size={17} /> : <Rocket size={17} />}
                  <span>{error || notice}</span>
                </div>
              </section>
            )}

            <section className="grid gap-4 md:grid-cols-4">
              {dashboardStats.map((item) => (
                <WebBuilderStat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
              <aside className="grid gap-4">
                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="orbit-kicker">Project List</p>
                      <h3 className="mt-1 text-lg font-black text-white">
                        Owned Projects
                      </h3>
                    </div>
                    <Layers3 className="text-amber-300" size={21} />
                  </div>

                  {isLoadingProjects ? (
                    <WebBuilderLoading />
                  ) : projects.length ? (
                    <div className="grid gap-2">
                      {projects.map((project) => (
                        <button
                          className={`rounded-lg border p-3 text-left transition ${
                            project.id === selectedProjectId
                              ? "border-amber-300/35 bg-amber-300/10"
                              : "border-white/10 bg-black/20 hover:border-white/20"
                          }`}
                          key={project.id}
                          onClick={() => setSelectedProjectId(project.id)}
                          type="button">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-black text-white">
                                {project.title}
                              </h4>
                              <p className="mt-1 truncate text-xs text-zinc-500">
                                /{project.slug}
                              </p>
                            </div>
                            <StatusPill
                              tone={project.status === "exported" ? "green" : "amber"}>
                              {project.status}
                            </StatusPill>
                          </div>
                          <p className="mt-3 text-xs text-zinc-600">
                            Updated {formatDateTime(project.updatedAt)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <WebBuilderEmptyState title="Belum ada project">
                      Buat project pertama untuk mengaktifkan workspace Web
                      Builder.
                    </WebBuilderEmptyState>
                  )}
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <p className="orbit-kicker">Create Project</p>
                  <form className="mt-4 grid gap-3" onSubmit={handleCreateProject}>
                    <FieldInput
                      label="Title"
                      maxLength={160}
                      onChange={(value) =>
                        setProjectForm((current) => ({ ...current, title: value }))
                      }
                      placeholder="Papua Selatan News Hub"
                      value={projectForm.title}
                    />
                    <FieldInput
                      label="Slug"
                      maxLength={80}
                      onChange={(value) =>
                        setProjectForm((current) => ({
                          ...current,
                          slug: normalizeSlugInput(value),
                        }))
                      }
                      placeholder="papua-selatan-news-hub"
                      value={projectForm.slug}
                    />
                    <FieldTextarea
                      label="Description"
                      maxLength={800}
                      onChange={(value) =>
                        setProjectForm((current) => ({
                          ...current,
                          description: value,
                        }))
                      }
                      placeholder="Portal editorial untuk paket berita daerah."
                      value={projectForm.description}
                    />
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300 px-4 py-3 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isCreatingProject}
                      type="submit">
                      {isCreatingProject ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                      Create Project
                    </button>
                  </form>
                </section>
              </aside>

              <section className="grid gap-4">
                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Project Detail</p>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        {selectedProject?.title || "No project selected"}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        {selectedProject?.description ||
                          "Pilih project untuk melihat halaman dan status export."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedProjectId || isExporting}
                        onClick={handleExportProject}
                        type="button">
                        {isExporting ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <FileCode2 size={15} />
                        )}
                        Export
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!lastExport?.html}
                        onClick={handleDownloadExport}
                        type="button">
                        <ArrowUpRight size={15} />
                        Download HTML
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <StatusLine label="Slug" value={selectedProject?.slug || "-"} />
                    <StatusLine
                      label="Status"
                      value={selectedProject?.status || "-"}
                    />
                    <StatusLine
                      label="Last Export"
                      value={formatDateTime(selectedProject?.lastExportedAt)}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Component Library</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Reusable blocks
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Pilih blok untuk template halaman dan live preview.
                      </p>
                    </div>
                    <StatusPill tone="green">
                      {draftSections.length} sections
                    </StatusPill>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {componentLibrary.map((component) => (
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-300/30 hover:bg-amber-300/10"
                        key={component.id}
                        onClick={() => handleAddSection(component.id)}
                        type="button">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white">
                              {component.label}
                            </h4>
                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                              {component.summary}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                            <Plus size={12} />
                            Add
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="orbit-kicker">Section Builder</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Compose page sections
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Tambah, edit, hapus, dan urutkan section. Preview
                        sinkron langsung dari draft ini.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={autosaveStatusMeta.tone}>
                        {autosaveStatusMeta.label}
                      </StatusPill>
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/30 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!canUndoSections}
                        onClick={handleUndoSections}
                        type="button">
                        Undo
                      </button>
                      <button
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-amber-300/30 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!canRedoSections}
                        onClick={handleRedoSections}
                        type="button">
                        Redo
                      </button>
                      <StatusPill>{draftSections.length} draft</StatusPill>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="grid gap-2">
                      {draftSections.length ? (
                        draftSections.map((section, index) => {
                          const componentId = section.styles?.component || "";
                          const component = componentLibrary.find(
                            (item) => item.id === componentId,
                          );
                          const isActive = activeDraftSection?.id === section.id;
                          const isDragged = draggedSectionId === section.id;

                          return (
                            <article
                              className={`rounded-lg border p-3 transition ${
                                isActive
                                  ? "border-amber-300/35 bg-amber-300/10"
                                  : "border-white/10 bg-black/20"
                              } ${isDragged ? "opacity-50" : ""}`}
                              key={section.id}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropSection(section.id)}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <button
                                    aria-label={`Drag ${section.props?.title || section.type || "section"}`}
                                    className="mt-0.5 inline-flex shrink-0 cursor-grab items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-zinc-300 active:cursor-grabbing"
                                    draggable
                                    onDragEnd={handleDragEndSection}
                                    onDragStart={(event) =>
                                      handleDragStartSection(section.id, event)
                                    }
                                    title="Drag to reorder"
                                    type="button">
                                    <GripVertical size={15} />
                                  </button>
                                  <button
                                    className="min-w-0 text-left"
                                    onClick={() => setActiveSectionId(section.id)}
                                    type="button">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                                      {component?.label || section.type}
                                    </p>
                                    <h4 className="mt-1 truncate text-sm font-black text-white">
                                      {section.props?.title || "Untitled section"}
                                    </h4>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                      {section.props?.body ||
                                        section.props?.content ||
                                        "No body copy yet."}
                                    </p>
                                  </button>
                                </div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    className="orbit-icon-button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveSection(section.id, -1)}
                                    title="Move section up"
                                    type="button">
                                    <ArrowUp size={15} />
                                  </button>
                                  <button
                                    className="orbit-icon-button"
                                    disabled={index === draftSections.length - 1}
                                    onClick={() => handleMoveSection(section.id, 1)}
                                    title="Move section down"
                                    type="button">
                                    <ArrowDown size={15} />
                                  </button>
                                  <button
                                    className="orbit-icon-button text-rose-200"
                                    onClick={() => handleDeleteSection(section.id)}
                                    title="Delete section"
                                    type="button">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <WebBuilderEmptyState title="Belum ada section">
                          Tambahkan section dari Component Library untuk mulai
                          membangun halaman.
                        </WebBuilderEmptyState>
                      )}
                      {draftSections.length ? (
                        <button
                          className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-left text-xs font-semibold text-zinc-500 transition hover:border-amber-300/35 hover:bg-amber-300/5 hover:text-zinc-300"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleDropSectionToEnd}
                          type="button">
                          Drop here to append the dragged section to the end.
                        </button>
                      ) : null}
                    </div>

                    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
                      <p className="orbit-kicker">Section Edit</p>
                      {activeDraftSection ? (
                        <div className="mt-4 grid gap-3">
                          <StatusLine
                            label="Type"
                            value={
                              activeDraftSection.styles?.component ||
                              activeDraftSection.type
                            }
                          />
                          <FieldInput
                            label="Label"
                            maxLength={80}
                            onChange={(value) => handleEditSection("label", value)}
                            placeholder="Section label"
                            value={activeDraftSection.props?.label || ""}
                          />
                          <FieldInput
                            label="Title"
                            maxLength={160}
                            onChange={(value) => handleEditSection("title", value)}
                            placeholder="Section title"
                            value={activeDraftSection.props?.title || ""}
                          />
                          <FieldTextarea
                            label="Body"
                            maxLength={800}
                            onChange={(value) => handleEditSection("body", value)}
                            placeholder="Section body"
                            value={activeDraftSection.props?.body || ""}
                          />
                          <FieldInput
                            label="Action Label"
                            maxLength={80}
                            onChange={(value) =>
                              handleEditSection("actionLabel", value)
                            }
                            placeholder="Button label"
                            value={activeDraftSection.props?.actionLabel || ""}
                          />
                          {Array.isArray(activeDraftSection.props?.items) && (
                            <FieldTextarea
                              label="Items"
                              maxLength={800}
                              onChange={handleEditSectionItems}
                              placeholder="One item per line"
                              value={activeDraftSection.props.items.join("\n")}
                            />
                          )}
                        </div>
                      ) : (
                        <WebBuilderEmptyState title="Tidak ada section aktif">
                          Pilih atau tambahkan section untuk membuka editor.
                        </WebBuilderEmptyState>
                      )}
                    </article>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="orbit-kicker">Pages</p>
                        <h3 className="mt-1 text-lg font-black text-white">
                          Project Pages
                        </h3>
                      </div>
                      {isLoadingDetail && (
                        <Loader2 className="animate-spin text-amber-300" size={18} />
                      )}
                    </div>

                    {isLoadingDetail ? (
                      <WebBuilderLoading />
                    ) : pages.length ? (
                      <div className="grid gap-3">
                        {pages.map((page) => (
                          <button
                            className={`rounded-lg border p-4 text-left transition ${
                              page.id === selectedPageId
                                ? "border-amber-300/35 bg-amber-300/10"
                                : "border-white/10 bg-black/20 hover:border-white/20"
                            }`}
                            onClick={() => setSelectedPageId(page.id)}
                            key={page.id}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-black text-white">
                                  {page.title}
                                </h4>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {page.path} - {page.sections?.length || 0} sections
                                </p>
                              </div>
                              <span className="text-xs font-bold text-zinc-500">
                                #{page.sortOrder ?? 0}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <WebBuilderEmptyState title="Belum ada halaman">
                        Tambahkan halaman pertama untuk project terpilih.
                      </WebBuilderEmptyState>
                    )}
                  </article>

                  <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <p className="orbit-kicker">Create Page</p>
                    <form className="mt-4 grid gap-3" onSubmit={handleCreatePage}>
                      <FieldInput
                        label="Title"
                        maxLength={160}
                        onChange={(value) =>
                          setPageForm((current) => ({ ...current, title: value }))
                        }
                        placeholder="Home"
                        value={pageForm.title}
                      />
                      <FieldInput
                        label="Path"
                        maxLength={120}
                        onChange={(value) =>
                          setPageForm((current) => ({
                            ...current,
                            path: value.toLowerCase(),
                          }))
                        }
                        placeholder="/"
                        value={pageForm.path}
                      />
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedProjectId || isCreatingPage}
                        type="submit">
                        {isCreatingPage ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                        Create Page
                      </button>
                    </form>
                  </article>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="orbit-kicker">Live Preview</p>
                      <h3 className="mt-2 text-lg font-black text-white">
                        Realtime render
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        Preview berubah saat state project/page berubah dan ikut
                        refresh otomatis setiap {AUTO_REFRESH_MS / 1000} detik.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewViewports).map(([key, item]) => {
                        const Icon = item.icon;
                        const isActive = previewMode === key;

                        return (
                          <button
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition ${
                              isActive
                                ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                                : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                            }`}
                            key={key}
                            onClick={() => setPreviewMode(key)}
                            type="button">
                            <Icon size={15} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="overflow-auto rounded-md border border-white/10 bg-[#0a0a0b] p-3">
                      <div
                        className="mx-auto overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl shadow-black/40"
                        style={{
                          maxWidth: previewFrame.maxWidth,
                          width: previewFrame.width,
                        }}>
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                          <span>{previewFrame.label}</span>
                          <span>auto refresh {AUTO_REFRESH_MS / 1000}s</span>
                        </div>
                        <iframe
                          className="block min-h-[640px] w-full bg-black"
                          key={`${selectedProjectId || "draft"}-${previewMode}-${previewRevision}`}
                          sandbox=""
                          srcDoc={previewHtml}
                          title="Web Builder Live Preview"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function FieldInput({ label, maxLength, onChange, placeholder, value }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <input
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-300/40"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function FieldTextarea({ label, maxLength, onChange, placeholder, value }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <textarea
        className="min-h-24 resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-300/40"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <strong className="truncate text-right text-xs font-black text-zinc-100">
        {value}
      </strong>
    </div>
  );
}
