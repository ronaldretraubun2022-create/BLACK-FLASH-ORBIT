import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { KnowledgeDeleteDialog } from "../features/knowledge/KnowledgeDeleteDialog";
import { KnowledgeDocumentList } from "../features/knowledge/KnowledgeDocumentList";
import { KnowledgeDocumentModal } from "../features/knowledge/KnowledgeDocumentModal";
import { KnowledgePreviewModal } from "../features/knowledge/KnowledgePreviewModal";
import { KnowledgeStats } from "../features/knowledge/KnowledgeStats";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  formatKnowledgeFileSize,
  getKnowledgeDocuments,
  getKnowledgeFileType,
  getKnowledgeFileValidation,
  toggleKnowledgeAiContext,
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
} from "../services/knowledgeService";

const UPLOAD_STATUS_META = {
  error: {
    className: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    label: "Error",
  },
  processing: {
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    label: "Processing",
  },
  ready: {
    className: "border-slate-300/15 bg-white/[0.04] text-slate-300",
    label: "Ready",
  },
  success: {
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    label: "Success",
  },
  uploading: {
    className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    label: "Uploading",
  },
};

function createUploadItem(file) {
  const validationError = getKnowledgeFileValidation(file);

  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${createQueueId()}`,
    message: validationError || "Ready to upload.",
    progress: 0,
    status: validationError ? "error" : "ready",
    validationError,
  };
}

function createQueueId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [editorMode, setEditorMode] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [deleteDocumentTarget, setDeleteDocumentTarget] = useState(null);
  const [uploadItems, setUploadItems] = useState([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadUseInAiContext, setUploadUseInAiContext] = useState(true);
  const [uploadInputKey, setUploadInputKey] = useState(0);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return documents;

    return documents.filter((document) =>
      [document.title, document.source, document.content]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [documents, searchQuery]);

  const uploadableItems = uploadItems.filter(
    (item) =>
      !item.validationError &&
      ["ready", "error"].includes(item.status) &&
      item.status !== "success",
  );
  const successfulUploads = uploadItems.filter(
    (item) => item.status === "success",
  ).length;
  const failedUploads = uploadItems.filter(
    (item) => item.status === "error",
  ).length;
  const uploadStats = useMemo(() => {
    const totalProgress = uploadItems.reduce(
      (total, item) => total + Number(item.progress || 0),
      0,
    );

    return {
      active: uploadItems.filter((item) =>
        ["uploading", "processing"].includes(item.status),
      ).length,
      failed: failedUploads,
      invalid: uploadItems.filter((item) => item.validationError).length,
      progress:
        uploadItems.length === 0
          ? 0
          : Math.round(totalProgress / uploadItems.length),
      ready: uploadableItems.length,
      success: successfulUploads,
      total: uploadItems.length,
    };
  }, [failedUploads, successfulUploads, uploadItems, uploadableItems.length]);

  async function loadDocuments({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }
    setError("");

    try {
      setDocuments(await getKnowledgeDocuments());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  function openAddModal() {
    setSelectedDocument(null);
    setEditorMode("add");
    setError("");
    setSuccess("");
  }

  function openEditModal(document) {
    setSelectedDocument(document);
    setEditorMode("edit");
    setError("");
    setSuccess("");
  }

  function closeEditorModal() {
    setEditorMode("");
    setSelectedDocument(null);
  }

  function addUploadFiles(fileList) {
    const nextFiles = Array.from(fileList || []);

    if (nextFiles.length === 0) return;

    setError("");
    setSuccess("");
    setUploadItems((currentItems) => [
      ...nextFiles.map(createUploadItem),
      ...currentItems,
    ]);
  }

  function handleFileInputChange(event) {
    addUploadFiles(event.target.files);
    event.target.value = "";
  }

  function removeUploadItem(itemId) {
    setUploadItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }

  function clearUploadItems() {
    if (isUploading) return;

    setUploadItems([]);
    setUploadInputKey((currentKey) => currentKey + 1);
  }

  function updateUploadItem(itemId, patch) {
    setUploadItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  function handleDragEnter(event) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragActive(false);
    addUploadFiles(event.dataTransfer.files);
  }

  async function saveDocument(form) {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editorMode === "edit" && selectedDocument?.id) {
        const updatedDocument = await updateKnowledgeDocument(
          selectedDocument.id,
          form,
        );

        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === updatedDocument.id ? updatedDocument : document,
          ),
        );
        setSuccess("Knowledge updated.");
      } else {
        const createdDocument = await createKnowledgeDocument(form);

        setDocuments((currentDocuments) => [
          createdDocument,
          ...currentDocuments,
        ]);
        setSuccess("Knowledge saved.");
      }

      closeEditorModal();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAiContext(document, nextValue) {
    const previousDocuments = documents;

    setDocuments((currentDocuments) =>
      currentDocuments.map((item) =>
        item.id === document.id
          ? { ...item, useInAiContext: nextValue }
          : item,
      ),
    );
    setError("");
    setSuccess("");

    try {
      const updatedDocument = await toggleKnowledgeAiContext(
        document.id,
        nextValue,
      );

      setDocuments((currentDocuments) =>
        currentDocuments.map((item) =>
          item.id === updatedDocument.id ? updatedDocument : item,
        ),
      );
    } catch (toggleError) {
      setDocuments(previousDocuments);
      setError(getErrorMessage(toggleError));
    }
  }

  async function confirmDeleteDocument() {
    if (!deleteDocumentTarget?.id) return;

    const target = deleteDocumentTarget;
    const previousDocuments = documents;

    setIsDeleting(true);
    setError("");
    setSuccess("");
    setDeleteDocumentTarget(null);
    setDocuments((currentDocuments) =>
      currentDocuments.filter((document) => document.id !== target.id),
    );

    try {
      await deleteKnowledgeDocument(target.id);
      setSuccess("Knowledge deleted.");
    } catch (deleteError) {
      setDocuments(previousDocuments);
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  async function submitUpload(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (uploadableItems.length === 0) {
      setError("Tidak ada file valid yang siap diupload.");
      return;
    }

    setIsUploading(true);

    let uploadedCount = 0;

    for (const item of uploadableItems) {
      updateUploadItem(item.id, {
        message: "Uploading...",
        progress: 2,
        status: "uploading",
      });

      try {
        await uploadKnowledgeDocument({
          file: item.file,
          onProgress: (progress) => {
            updateUploadItem(item.id, {
              progress,
              status: progress >= 95 ? "processing" : "uploading",
              message: progress >= 95 ? "Processing document..." : "Uploading...",
            });
          },
          title: uploadableItems.length === 1 ? uploadTitle : "",
          useInAiContext: uploadUseInAiContext,
        });

        uploadedCount += 1;
        updateUploadItem(item.id, {
          message: "Uploaded successfully.",
          progress: 100,
          status: "success",
        });
      } catch (uploadError) {
        updateUploadItem(item.id, {
          message: getErrorMessage(uploadError),
          progress: 100,
          status: "error",
        });
      }
    }

    if (uploadedCount > 0) {
      await loadDocuments({ silent: true });
      setSuccess(`${uploadedCount} document uploaded. Knowledge list refreshed.`);
      setUploadTitle("");
      setUploadInputKey((currentKey) => currentKey + 1);
    }

    setIsUploading(false);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <section className="rounded-3xl border border-cyan-300/15 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <BrainCircuit size={23} />
            </span>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
              KNOWLEDGE BASE
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Knowledge Base
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Personal AI Memory
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100"
              onClick={() => loadDocuments()}
              type="button">
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20"
              onClick={openAddModal}
              type="button">
              <Plus size={16} />
              Add Knowledge
            </button>
          </div>
        </div>
      </section>

      {(error || success) && (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            error
              ? "border-rose-300/20 bg-rose-300/5 text-rose-200"
              : "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"
          }`}>
          {error || success}
        </div>
      )}

      <KnowledgeStats documents={documents} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 text-slate-500 transition focus-within:border-cyan-300/35">
            <Search size={17} />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, content, source..."
              type="search"
              value={searchQuery}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
            <span className="rounded-full border border-white/10 px-3 py-1">
              Showing: {filteredDocuments.length}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              AI Enabled:{" "}
              {documents.filter((document) => document.useInAiContext).length}
            </span>
          </div>
        </div>

        <form
          className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"
          onSubmit={submitUpload}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <FileUp size={18} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                UPLOAD CENTER
              </p>
              <h3 className="text-base font-black text-white">
                TXT, MD, PDF, DOCX
              </h3>
            </div>
          </div>

          <div
            className={`mt-4 rounded-2xl border border-dashed p-5 text-center transition ${
              isDragActive
                ? "border-cyan-300/60 bg-cyan-300/10"
                : "border-white/15 bg-black/20 hover:border-cyan-300/35"
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <UploadCloud className="mx-auto text-cyan-300" size={28} />
            <p className="mt-3 text-sm font-black text-white">
              Drop files here or select from device
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Multi-file upload, max 8 MB each. Unsupported files are rejected
              before sending.
            </p>
            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20">
              Select Files
              <input
                accept=".txt,.md,.pdf,.docx"
                className="sr-only"
                key={uploadInputKey}
                multiple
                onChange={handleFileInputChange}
                type="file"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-50"
              disabled={uploadItems.length > 1 || isUploading}
              maxLength={180}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Optional title for single file"
              value={uploadTitle}
            />
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-slate-200">
              <input
                checked={uploadUseInAiContext}
                className="size-4 accent-cyan-300"
                disabled={isUploading}
                onChange={(event) =>
                  setUploadUseInAiContext(event.target.checked)
                }
                type="checkbox"
              />
              Use in AI Context
            </label>

            <UploadQueue
              isUploading={isUploading}
              items={uploadItems}
              onClear={clearUploadItems}
              onRemove={removeUploadItem}
              stats={uploadStats}
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
                disabled={isUploading || uploadableItems.length === 0}
                type="submit">
                <ShieldCheck size={16} />
                {isUploading ? "Uploading..." : `Upload ${uploadableItems.length || ""}`}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-50"
                disabled={isUploading || uploadItems.length === 0}
                onClick={clearUploadItems}
                type="button">
                <Trash2 size={15} />
                Clear
              </button>
            </div>

            {(successfulUploads > 0 || failedUploads > 0) && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-400">
                Uploaded: {successfulUploads} | Needs attention: {failedUploads}
              </div>
            )}
          </div>
        </form>
      </section>

      <KnowledgeDocumentList
        documents={filteredDocuments}
        isLoading={isLoading}
        onDelete={setDeleteDocumentTarget}
        onEdit={openEditModal}
        onToggleContext={toggleAiContext}
        onView={setPreviewDocument}
      />

      {editorMode && (
        <KnowledgeDocumentModal
          document={selectedDocument}
          isLoading={isSaving}
          mode={editorMode}
          onClose={closeEditorModal}
          onSubmit={saveDocument}
        />
      )}

      <KnowledgePreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      <KnowledgeDeleteDialog
        document={deleteDocumentTarget}
        isLoading={isDeleting}
        onClose={() => setDeleteDocumentTarget(null)}
        onConfirm={confirmDeleteDocument}
      />
    </div>
  );
}

function UploadQueue({ isUploading, items, onClear, onRemove, stats }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-500">
        No files selected.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Upload Queue
        </span>
        <button
          className="text-xs font-black text-slate-500 transition hover:text-cyan-100 disabled:opacity-40"
          disabled={isUploading}
          onClick={onClear}
          type="button">
          Clear all
        </button>
      </div>
      <QueueProgressSummary stats={stats} />
      {items.map((item) => (
        <UploadQueueItem item={item} key={item.id} onRemove={onRemove} />
      ))}
    </div>
  );
}

function QueueProgressSummary({ stats }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black text-slate-300">
          Queue Progress
        </span>
        <span className="text-xs font-black text-cyan-100">
          {stats.progress}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-300 transition-all"
          style={{ width: `${stats.progress}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <QueueStatBadge label="Total" value={stats.total} />
        <QueueStatBadge label="Ready" value={stats.ready} />
        <QueueStatBadge label="Active" value={stats.active} />
        <QueueStatBadge label="Success" tone="success" value={stats.success} />
        <QueueStatBadge label="Error" tone="error" value={stats.failed} />
        {stats.invalid > 0 && (
          <QueueStatBadge label="Invalid" tone="error" value={stats.invalid} />
        )}
      </div>
    </div>
  );
}

function QueueStatBadge({ label, tone = "default", value }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
        : "border-white/10 bg-white/[0.04] text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${toneClass}`}>
      {label}: {value}
    </span>
  );
}

function UploadQueueItem({ item, onRemove }) {
  const isLocked = ["uploading", "processing"].includes(item.status);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-100">
              {getKnowledgeFileType(item.file)}
            </span>
            <strong className="break-all text-sm text-white">
              {item.file.name}
            </strong>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {formatKnowledgeFileSize(item.file.size)}
          </p>
        </div>
        <button
          aria-label={`Remove ${item.file.name}`}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-rose-300/25 hover:text-rose-100 disabled:opacity-40"
          disabled={isLocked}
          onClick={() => onRemove(item.id)}
          type="button">
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            item.status === "error" ? "bg-rose-300" : "bg-cyan-300"
          }`}
          style={{ width: `${item.progress}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={`text-xs font-bold ${getStatusColor(item.status)}`}>
          {item.message}
        </span>
        <UploadStatusBadge status={item.status} />
      </div>
    </article>
  );
}

function UploadStatusBadge({ status }) {
  const meta = UPLOAD_STATUS_META[status] || UPLOAD_STATUS_META.ready;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${meta.className}`}>
      <UploadStatusIcon status={status} />
      {meta.label}
    </span>
  );
}

function UploadStatusIcon({ status }) {
  if (status === "success") return <CheckCircle2 size={12} />;
  if (status === "error") return <AlertTriangle size={12} />;
  if (status === "uploading") {
    return <Loader2 className="animate-spin" size={12} />;
  }
  if (status === "processing") return <Clock3 size={12} />;

  return <FileUp size={12} />;
}

function getStatusColor(status) {
  if (status === "success") return "text-emerald-200";
  if (status === "error") return "text-rose-200";
  if (status === "uploading" || status === "processing") {
    return "text-cyan-100";
  }

  return "text-slate-400";
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Knowledge request failed.";
  }
}
