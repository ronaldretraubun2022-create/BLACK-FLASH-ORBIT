import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  Files,
  Folder,
  Gauge,
  Layers3,
  Link2,
  PanelRight,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { AiKnowledgeCopilot } from "../components/knowledge/AiKnowledgeCopilot.jsx";
import {
  initialKnowledgeActivityLog,
  knowledgeCollections,
  knowledgeDocuments,
  knowledgeReleaseState,
  mockUploadQueue,
} from "../data/knowledgeMock.js";
import { useProfile } from "../hooks/useProfile.js";
import { useKnowledgeCopilot } from "../hooks/useKnowledgeCopilot.js";
import { searchKnowledge } from "../lib/mockRagEngine.js";

function getNowLabel() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jayapura",
  });
}

export function KnowledgeBase() {
  const { profile } = useProfile();
  const userRole = profile?.role || "user";
  const [activeCollectionId, setActiveCollectionId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(
    knowledgeDocuments[0],
  );
  const [favoriteIds, setFavoriteIds] = useState(
    () =>
      new Set(
        knowledgeDocuments
          .filter((document) => document.favorite)
          .map((document) => document.id),
      ),
  );
  const [activityLog, setActivityLog] = useState(initialKnowledgeActivityLog);
  const [mockUploadState, setMockUploadState] = useState({
    phase: "Ready",
    indexedCount: 0,
    queueCount: mockUploadQueue.length,
  });
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const searchInputRef = useRef(null);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return knowledgeDocuments.filter((document) => {
      const isInCollection =
        activeCollectionId === "all" ||
        document.collectionId === activeCollectionId;

      if (!isInCollection) return false;
      if (!query) return true;

      return [
        document.title,
        document.source,
        document.type,
        document.summary,
        document.excerpt,
        ...document.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeCollectionId, searchQuery]);

  const addActivity = useCallback((action, detail, tone = "gold") => {
    setActivityLog((currentLog) => [
      {
        id: `${Date.now()}-${action}`,
        action,
        detail,
        time: `${getNowLabel()} WIT`,
        tone,
      },
      ...currentLog.slice(0, 6),
    ]);
  }, []);

  const copilot = useKnowledgeCopilot({
    activeDocument: selectedDocument,
    documents: knowledgeDocuments,
    onActivity: addActivity,
  });

  const semanticResults = useMemo(
    () => searchKnowledge(searchQuery, filteredDocuments).slice(0, 4),
    [filteredDocuments, searchQuery],
  );

  const favoriteDocuments = useMemo(
    () => knowledgeDocuments.filter((document) => favoriteIds.has(document.id)),
    [favoriteIds],
  );

  useEffect(() => {
    if (!filteredDocuments.length) return;
    if (filteredDocuments.some((document) => document.id === selectedDocument.id)) {
      return;
    }

    setSelectedDocument(filteredDocuments[0]);
  }, [filteredDocuments, selectedDocument.id]);

  const metrics = useMemo(
    () => [
      {
        icon: Files,
        label: "Documents",
        value: knowledgeDocuments.length,
        detail: "mock library",
      },
      {
        icon: Database,
        label: "RAG Ready",
        value: knowledgeDocuments.filter((document) => document.confidence >= 90)
          .length,
        detail: "trusted context",
      },
      {
        icon: Link2,
        label: "Citations",
        value: knowledgeDocuments.reduce(
          (total, document) => total + document.citations.length,
          0,
        ),
        detail: "source cards",
      },
      {
        icon: Star,
        label: "Favorites",
        value: favoriteDocuments.length,
        detail: "pinned docs",
      },
    ],
    [favoriteDocuments.length],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function syncHashTarget() {
      const targetId = window.location.hash.replace("#", "");
      if (!targetId) return;

      if (targetId === "copilot") {
        setIsCopilotOpen(true);
      }

      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }

    syncHashTarget();
    window.addEventListener("hashchange", syncHashTarget);

    return () => window.removeEventListener("hashchange", syncHashTarget);
  }, []);

  useKnowledgeKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onOpenCopilot: () => setIsCopilotOpen(true),
    onCloseCopilot: () => setIsCopilotOpen(false),
    onToggleFavorite: toggleFavorite,
    onToggleUpload: handleMockUpload,
    setActiveCollectionId,
    selectedDocument,
  });

  const copilotProps = {
    activeDocument: selectedDocument,
    citations: copilot.citations,
    commandActions: copilot.commandActions,
    confidence: copilot.confidence,
    isLoading: copilot.isLoading,
    messages: copilot.messages,
    onRunCommandAction: copilot.runCommandAction,
    onSubmitQuestion: copilot.submitQuestion,
    quickPrompts: copilot.quickPrompts,
    selectedContext: copilot.selectedContext,
  };

  const handleSelectDocument = useCallback((document) => {
    setSelectedDocument(document);
    addActivity(
      "Document preview opened",
      `${document.title} loaded in preview panel.`,
      "green",
    );
  }, [addActivity]);

  const toggleFavorite = useCallback((document) => {
    const isFavorite = favoriteIds.has(document.id);

    setFavoriteIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (isFavorite) {
        nextIds.delete(document.id);
      } else {
        nextIds.add(document.id);
      }

      return nextIds;
    });
    addActivity(
      isFavorite ? "Favorite removed" : "Favorite pinned",
      document.title,
      isFavorite ? "maroon" : "gold",
    );
  }, [addActivity, favoriteIds]);

  const handleMockUpload = useCallback(() => {
    const nextPhase =
      mockUploadState.phase === "Ready" ? "Validated" : "Ready";
    const nextIndexedCount =
      nextPhase === "Validated"
        ? filteredDocuments.length
        : Math.max(0, mockUploadState.indexedCount - 1);

    setMockUploadState({
      phase: nextPhase,
      indexedCount: nextIndexedCount,
      queueCount: mockUploadQueue.length,
    });
    addActivity(
      "Mock upload checked",
      nextPhase === "Validated"
        ? `Upload panel indexed ${nextIndexedCount} local document(s) without backend traffic.`
        : "Upload panel reset to ready state.",
      nextPhase === "Validated" ? "green" : "gold",
    );
  }, [addActivity, filteredDocuments.length, mockUploadState.indexedCount, mockUploadState.phase]);

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar
          releaseState={knowledgeReleaseState}
          userRole={userRole}
        />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Knowledge Base v3.0</p>
              <h1 className="text-xl font-black text-white md:text-2xl">
                AI Knowledge Copilot Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="Knowledge notifications"
                className="orbit-icon-button"
                type="button">
                <Bell size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <KnowledgeHero
              metrics={metrics}
              onOpenCopilot={() => setIsCopilotOpen(true)}
              selectedDocument={selectedDocument}
            />

            <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_420px]">
              <CollectionSidebar
                activeCollectionId={activeCollectionId}
                collections={knowledgeCollections}
                onSelectCollection={setActiveCollectionId}
              />

              <div className="grid gap-4">
                <SemanticSearchPanel
                  id="knowledge-search"
                  onSearchChange={setSearchQuery}
                  onSelectDocument={handleSelectDocument}
                  query={searchQuery}
                  inputRef={searchInputRef}
                  results={semanticResults}
                />
                <DocumentLibrary
                  documents={filteredDocuments}
                  favoriteIds={favoriteIds}
                  onSelectDocument={handleSelectDocument}
                  onToggleFavorite={toggleFavorite}
                  selectedDocumentId={selectedDocument.id}
                />
                <DocumentPreview document={selectedDocument} />
              </div>

              <aside className="hidden xl:block">
                <AiKnowledgeCopilot {...copilotProps} variant="panel" />
              </aside>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-4 lg:grid-cols-2">
                <SourceCitationCards document={selectedDocument} />
                <RagContextPreview
                  document={selectedDocument}
                  id="knowledge-rag-preview"
                />
              </div>

              <aside className="grid gap-4 content-start">
                <UploadPanel
                  mockUploadState={mockUploadState}
                  onMockUpload={handleMockUpload}
                  uploadQueue={mockUploadQueue}
                  indexedCount={mockUploadState.indexedCount}
                  queueCount={mockUploadState.queueCount}
                />
                <FavoritesPanel
                  documents={favoriteDocuments}
                  id="knowledge-favorites"
                  onSelectDocument={handleSelectDocument}
                />
                <ActivityLog entries={activityLog} />
              </aside>
            </section>
          </div>
        </section>
      </div>

      <button
        aria-label="Open AI Knowledge Copilot"
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57] px-4 text-sm font-black text-black shadow-2xl shadow-black/40 xl:hidden"
        onClick={() => setIsCopilotOpen(true)}
        type="button">
        <BrainCircuit size={18} />
        AI Copilot
      </button>

      {isCopilotOpen ? (
        <AiKnowledgeCopilot
          {...copilotProps}
          onClose={() => setIsCopilotOpen(false)}
          variant="drawer"
        />
      ) : null}
    </main>
  );
}

function useKnowledgeKeyboardShortcuts({
  onFocusSearch,
  onOpenCopilot,
  onCloseCopilot,
  onToggleFavorite,
  onToggleUpload,
  setActiveCollectionId,
  selectedDocument,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const key = event.key.toLowerCase();
      const hasMod = event.ctrlKey || event.metaKey;

      if (event.ctrlKey && event.shiftKey && key === "k") {
        event.preventDefault();
        onOpenCopilot();
        return;
      }

      if (hasMod && event.shiftKey && key === "f") {
        event.preventDefault();
        onToggleFavorite(selectedDocument);
        return;
      }

      if (hasMod && event.shiftKey && key === "u") {
        event.preventDefault();
        onToggleUpload();
        return;
      }

      if (!hasMod && key === "/" && !isTypingField) {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (key === "escape") {
        onCloseCopilot();
        return;
      }

      if (isTypingField) return;

      if (key === "1") {
        event.preventDefault();
        setActiveCollectionId("all");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        setActiveCollectionId("papua-selatan");
        return;
      }

      if (key === "3") {
        event.preventDefault();
        setActiveCollectionId("interview");
        return;
      }

      if (key === "4") {
        event.preventDefault();
        setActiveCollectionId("verification");
        return;
      }

      if (key === "5") {
        event.preventDefault();
        setActiveCollectionId("multimedia");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onCloseCopilot,
    onFocusSearch,
    onOpenCopilot,
    onToggleFavorite,
    onToggleUpload,
    selectedDocument,
    setActiveCollectionId,
  ]);
}

function KnowledgeHero({ metrics, onOpenCopilot, selectedDocument }) {
  return (
    <section className="rounded-lg border border-[#d9ad57]/20 bg-[linear-gradient(135deg,_rgba(217,173,87,0.13),_rgba(125,31,47,0.24)_42%,_rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-black/30 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <span className="grid size-12 place-items-center rounded-lg border border-[#d9ad57]/30 bg-[#d9ad57]/10 text-[#d9ad57]">
            <BrainCircuit size={24} />
          </span>
          <p className="mt-5 orbit-kicker">Protected Knowledge Route</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">
            Source-aware AI copilot for newsroom knowledge.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Local mock RAG panel untuk tanya dokumen, preview retrieved context,
            source citation cards, confidence score, quick prompts, command
            actions, upload staging, favorites, dan activity log tanpa klaim
            integrasi API real.
          </p>
          <button
            aria-label="Open AI Knowledge Copilot panel"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 xl:hidden"
            onClick={onOpenCopilot}
            type="button">
            <Sparkles size={16} />
            Open AI Copilot
          </button>
        </div>

        <div className="grid content-start gap-3 rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Active Preview
              </p>
              <h3 className="mt-2 text-lg font-black text-white">
                {selectedDocument.title}
              </h3>
            </div>
            <Gauge className="text-[#d9ad57]" size={24} />
          </div>
          <StatusLine label="Confidence" value={`${selectedDocument.confidence}%`} />
          <StatusLine label="Owner" value={selectedDocument.owner} />
          <StatusLine label="Updated" value={selectedDocument.updatedAt} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <MetricTile key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

function MetricTile({ detail, icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <Icon className="text-[#d9ad57]" size={22} />
      </div>
      <p className="mt-3 text-xs font-bold text-zinc-500">{detail}</p>
    </article>
  );
}

function CollectionSidebar({
  activeCollectionId,
  collections,
  onSelectCollection,
}) {
  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg border border-[#7d1f2f]/35 bg-[#7d1f2f]/20 text-[#f1c36f]">
          <Folder size={18} />
        </span>
        <div>
          <p className="orbit-kicker">Collections</p>
          <h2 className="text-lg font-black text-white">Source Groups</h2>
        </div>
      </div>

      <nav aria-label="Knowledge collections" className="mt-4 grid gap-2">
        {collections.map((collection) => {
          const isActive = activeCollectionId === collection.id;

          return (
            <button
              aria-label={`Open ${collection.label}`}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-bold transition ${
                isActive
                  ? "border-[#d9ad57]/35 bg-[#d9ad57]/12 text-white"
                  : "border-white/10 bg-black/20 text-zinc-400 hover:border-[#d9ad57]/25 hover:text-white"
              }`}
              key={collection.id}
              onClick={() => onSelectCollection(collection.id)}
              type="button">
              <span className="min-w-0 truncate">{collection.label}</span>
              <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">
                {collection.countLabel}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-lg border border-[#7d1f2f]/30 bg-[#7d1f2f]/16 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#f1c36f]">
          <ShieldCheck size={14} />
          Protected
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Route tetap berada di bawah auth guard yang sudah ada.
        </p>
      </div>
    </aside>
  );
}

function SemanticSearchPanel({
  id,
  inputRef,
  onSearchChange,
  onSelectDocument,
  query,
  results,
}) {
  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Search Knowledge</p>
          <h2 className="mt-1 text-lg font-black text-white">Context Match</h2>
        </div>
        <Sparkles className="text-[#d9ad57]" size={22} />
      </div>

      <label className="mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 text-zinc-500 transition focus-within:border-[#d9ad57]/45">
        <Search size={17} />
        <input
          aria-label="Search knowledge documents"
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:shadow-none"
          ref={inputRef}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Cari sumber, kutipan, isu, atau konteks RAG..."
          type="search"
          value={query}
        />
      </label>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {results.length ? (
          results.map(({ document, score }) => (
            <button
              aria-label={`Open ${document.title}`}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#d9ad57]/35 hover:bg-[#d9ad57]/8"
              key={document.id}
              onClick={() => onSelectDocument(document)}
              type="button">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {document.title}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {document.source}
                  </p>
                </div>
                <span className="rounded-md border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black text-[#f1c36f]">
                  {score}%
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-400">
                {document.summary}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-bold text-zinc-500 md:col-span-2">
            No matching documents.
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentLibrary({
  documents,
  favoriteIds,
  onSelectDocument,
  onToggleFavorite,
  selectedDocumentId,
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="orbit-kicker">Document Library</p>
          <h2 className="mt-1 text-lg font-black text-white">
            {documents.length} Sources
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
          <BookOpenText size={14} />
          Indexed
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {documents.length ? (
          documents.map((document) => {
            const isSelected = document.id === selectedDocumentId;
            const isFavorite = favoriteIds.has(document.id);

            return (
              <article
                className={`rounded-lg border p-4 transition ${
                  isSelected
                    ? "border-[#d9ad57]/40 bg-[#d9ad57]/10"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
                key={document.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <button
                    aria-label={`Preview ${document.title}`}
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectDocument(document)}
                    type="button">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
                        {document.type}
                      </span>
                      <StatusBadge status={document.status} />
                    </div>
                    <h3 className="mt-3 text-base font-black text-white">
                      {document.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {document.summary}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label={
                        isFavorite
                          ? `Remove ${document.title} from favorites`
                          : `Add ${document.title} to favorites`
                      }
                      className={`grid size-10 place-items-center rounded-lg border transition ${
                        isFavorite
                          ? "border-[#d9ad57]/35 bg-[#d9ad57]/15 text-[#f1c36f]"
                          : "border-white/10 bg-white/[0.04] text-zinc-500 hover:border-[#d9ad57]/30 hover:text-[#f1c36f]"
                      }`}
                      onClick={() => onToggleFavorite(document)}
                      type="button">
                      <Star
                        fill={isFavorite ? "currentColor" : "none"}
                        size={17}
                      />
                    </button>
                    <button
                      aria-label={`Open ${document.title}`}
                      className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-[#d9ad57]/30 hover:text-white"
                      onClick={() => onSelectDocument(document)}
                      type="button">
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <InfoPill label="Owner" value={document.owner} />
                  <InfoPill label="Tokens" value={document.tokens} />
                  <InfoPill label="Updated" value={document.updatedAt} />
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-5 text-sm font-bold text-zinc-500">
            No matching documents.
          </div>
        )}
      </div>
    </section>
  );
}

function UploadPanel({
  indexedCount,
  mockUploadState,
  onMockUpload,
  queueCount,
  uploadQueue,
}) {
  const isReady = mockUploadState.phase === "Ready";

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Upload Panel</p>
          <h2 className="mt-1 text-lg font-black text-white">Mock Intake</h2>
        </div>
        <UploadCloud className="text-[#d9ad57]" size={22} />
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[#d9ad57]/30 bg-black/25 p-4 text-center">
        <UploadCloud className="mx-auto text-[#d9ad57]" size={28} />
        <p className="mt-3 text-sm font-black text-white">Drop zone preview</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Local mock state only. No file leaves the browser.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <StatusLine label="Upload phase" value={mockUploadState.phase} />
          <StatusLine label="Indexed docs" value={String(indexedCount)} />
          <StatusLine label="Queue size" value={String(queueCount)} />
          <StatusLine
            label="Mode"
            value={isReady ? "Awaiting files" : "Mock indexing active"}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {uploadQueue.map((item) => (
          <div
            className="rounded-lg border border-white/10 bg-black/20 p-3"
            key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {item.name}
                </p>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  {item.size}
                </p>
              </div>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        aria-label="Validate mock upload queue"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20"
        onClick={onMockUpload}
        type="button">
        <CheckCircle2 size={16} />
        {isReady ? "Validate Mock Queue" : "Reset Mock Queue"}
      </button>
    </section>
  );
}

function FavoritesPanel({ documents, id, onSelectDocument }) {
  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Favorites</p>
          <h2 className="mt-1 text-lg font-black text-white">Pinned Sources</h2>
        </div>
        <Star className="text-[#d9ad57]" fill="currentColor" size={21} />
      </div>

      <div className="mt-4 grid gap-2">
        {documents.length ? (
          documents.map((document) => (
            <button
              aria-label={`Open favorite ${document.title}`}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#d9ad57]/30"
              key={document.id}
              onClick={() => onSelectDocument(document)}
              type="button">
              <p className="text-sm font-black text-white">{document.title}</p>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                {document.owner}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm font-bold text-zinc-500">
            Belum ada dokumen favorit.
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentPreview({ document }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="orbit-kicker">Document Preview</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {document.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            {document.excerpt}
          </p>
        </div>
        <div className="rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f1c36f]">
            Confidence
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {document.confidence}%
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPill label="Type" value={document.type} />
        <InfoPill label="Pages" value={document.pages} />
        <InfoPill label="Source" value={document.source} />
        <InfoPill label="Status" value={document.status} />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-black/25 p-4">
        <div className="flex items-center gap-2">
          <PanelRight className="text-[#d9ad57]" size={18} />
          <h3 className="text-sm font-black text-white">Editorial Notes</h3>
        </div>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          {document.summary}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {document.tags.map((tag) => (
          <span
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400"
            key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function SourceCitationCards({ document }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Selected Source Citations</p>
          <h2 className="mt-1 text-lg font-black text-white">
            {document.citations.length} Cards
          </h2>
        </div>
        <Link2 className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-3">
        {document.citations.length ? (
          document.citations.map((citation) => (
            <article
              className="rounded-lg border border-white/10 bg-black/20 p-3"
              key={citation.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    {citation.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {citation.locator}
                  </p>
                </div>
                <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
                  {citation.reliability}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">
                {citation.quote}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-bold text-zinc-500">
            No citations.
          </div>
        )}
      </div>
    </section>
  );
}

function RagContextPreview({ document, id }) {
  return (
    <section
      className="scroll-mt-24 rounded-lg border border-white/10 bg-white/[0.035] p-4"
      id={id}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">RAG Context Preview</p>
          <h2 className="mt-1 text-lg font-black text-white">Injected Context</h2>
        </div>
        <Layers3 className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-2">
        {document.contextChunks.length ? (
          document.contextChunks.map((chunk, index) => (
            <div
              className="rounded-lg border border-white/10 bg-black/25 p-3"
              key={chunk}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                Chunk {index + 1}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-300">{chunk}</p>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-bold text-zinc-500">
            No context retrieved.
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityLog({ entries }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="orbit-kicker">Activity Log</p>
          <h2 className="mt-1 text-lg font-black text-white">Recent Events</h2>
        </div>
        <Activity className="text-[#d9ad57]" size={21} />
      </div>

      <div className="mt-4 grid gap-3">
        {entries.map((entry) => (
          <article
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
            key={entry.id}>
            <span
              className={`mt-1 size-2 rounded-full ${getActivityTone(entry.tone)}`}
            />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-white">{entry.action}</p>
                <span className="shrink-0 text-[10px] font-black uppercase text-zinc-500">
                  {entry.time}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {entry.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs font-black text-zinc-200">
        {value}
      </span>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-zinc-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const className =
    status === "Verified"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : status === "Needs Review"
        ? "border-[#d9ad57]/25 bg-[#d9ad57]/10 text-[#f1c36f]"
        : "border-white/10 bg-white/[0.04] text-zinc-300";

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${className}`}>
      {status}
    </span>
  );
}

function getActivityTone(tone) {
  if (tone === "green") {
    return "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]";
  }

  if (tone === "maroon") {
    return "bg-[#b4233a] shadow-[0_0_14px_rgba(180,35,58,0.8)]";
  }

  return "bg-[#d9ad57] shadow-[0_0_14px_rgba(217,173,87,0.8)]";
}
