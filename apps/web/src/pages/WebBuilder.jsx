import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  FileCode2,
  Globe2,
  Layers3,
  Loader2,
  Plus,
  RefreshCcw,
  Rocket,
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

function createPagePayload(form) {
  const path = form.path.trim() || "/";

  return {
    path: path.startsWith("/") ? path : `/${path}`,
    sections: [],
    title: form.title.trim(),
  };
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
    tone === "green"
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

  const pages = Array.isArray(projectDetail?.pages) ? projectDetail.pages : [];
  const exportedProjects = projects.filter(
    (project) => project.status === "exported",
  ).length;
  const selectedProject =
    projectDetail ||
    projects.find((project) => project.id === selectedProjectId) ||
    null;

  const dashboardStats = useMemo(
    () => [
      { label: "Projects", value: projects.length },
      { label: "Pages", value: pages.length },
      { label: "Exported", value: exportedProjects },
      { label: "Auth", value: "ON" },
    ],
    [exportedProjects, pages.length, projects.length],
  );

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
      await api.createWebBuilderPage(selectedProjectId, createPagePayload(pageForm));
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
      const response = await api.exportWebBuilderProject(selectedProjectId);
      const exported = getResponseData(response, null);

      setLastExport(exported);
      setNotice("Export HTML berhasil dibuat dari backend.");
      await loadProjects();
      await loadProjectDetail(selectedProjectId);
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Gagal export project."));
    } finally {
      setIsExporting(false);
    }
  }

  function handleDownloadExport() {
    if (!lastExport?.html) return;

    const blob = new Blob([lastExport.html], { type: "text/html" });
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
                          <article
                            className="rounded-lg border border-white/10 bg-black/20 p-4"
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
                          </article>
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
