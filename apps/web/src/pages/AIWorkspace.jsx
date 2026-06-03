import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Clock3,
  Library,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  createChatSession,
  deleteChatSession,
  getChatPersistenceErrorMessage,
  getChatMessages,
  getChatSessions,
  getOrCreateActiveChatSession,
  renameChatSession,
  saveChatMessage,
  togglePinChatSession,
  updateChatSessionModel,
} from "../services/chatPersistence";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateErrorMessage,
  getPromptTemplates,
  togglePromptTemplateFavorite,
  updatePromptTemplate,
} from "../services/promptTemplates";

const modelOptions = [
  { label: "OpenRouter Auto", value: "openrouter/auto" },
  { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
  { label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
  { label: "Claude 3.5 Haiku", value: "anthropic/claude-3.5-haiku" },
  { label: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
];

const emptyPromptTemplateForm = {
  title: "",
  category: "Umum",
  prompt: "",
  isFavorite: false,
};

export function AIWorkspace() {
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] = useState("openrouter/auto");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [renameDialogSession, setRenameDialogSession] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteDialogSession, setDeleteDialogSession] = useState(null);
  const [promptTemplates, setPromptTemplates] = useState([]);
  const [promptTemplateSearchQuery, setPromptTemplateSearchQuery] =
    useState("");
  const [promptTemplateCategory, setPromptTemplateCategory] = useState("Semua");
  const [promptTemplateDialogMode, setPromptTemplateDialogMode] =
    useState("");
  const [promptTemplateDialogItem, setPromptTemplateDialogItem] =
    useState(null);
  const [promptTemplateForm, setPromptTemplateForm] = useState(
    emptyPromptTemplateForm,
  );
  const [deletePromptTemplateDialogItem, setDeletePromptTemplateDialogItem] =
    useState(null);
  const [isPromptTemplateLoading, setIsPromptTemplateLoading] = useState(false);
  const [isPromptTemplateActionLoading, setIsPromptTemplateActionLoading] =
    useState(false);
  const [isSessionActionLoading, setIsSessionActionLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);

  const conversationCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );
  const selectedModelLabel =
    modelOptions.find((model) => model.value === selectedModel)?.label ||
    selectedModel;
  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return messages;

    return messages.filter((message) =>
      [message.content, message.model, message.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [messages, searchQuery]);
  const filteredSessions = useMemo(() => {
    const query = sessionSearchQuery.trim().toLowerCase();

    if (!query) return sessions;

    return sessions.filter((session) =>
      session.title.toLowerCase().includes(query),
    );
  }, [sessionSearchQuery, sessions]);
  const promptTemplateCategories = useMemo(() => {
    const categorySet = new Set(
      promptTemplates.map((template) => template.category).filter(Boolean),
    );

    return ["Semua", ...Array.from(categorySet).sort()];
  }, [promptTemplates]);
  const filteredPromptTemplates = useMemo(() => {
    const query = promptTemplateSearchQuery.trim().toLowerCase();

    return promptTemplates.filter((template) => {
      const matchesCategory =
        promptTemplateCategory === "Semua" ||
        template.category === promptTemplateCategory;
      const matchesSearch =
        !query ||
        [template.title, template.prompt, template.category]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [promptTemplateCategory, promptTemplateSearchQuery, promptTemplates]);

  const loadSessionMessages = useCallback(async (sessionId) => {
    const databaseMessages = await getChatMessages(sessionId);
    setMessages(databaseMessages);
  }, []);

  const refreshSessions = useCallback(async (userId) => {
    const databaseSessions = await getChatSessions(userId);
    setSessions(databaseSessions);
    return databaseSessions;
  }, []);

  const refreshPromptTemplates = useCallback(async (userId) => {
    const databasePromptTemplates = await getPromptTemplates(userId);
    setPromptTemplates(databasePromptTemplates);
    return databasePromptTemplates;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeChatSession() {
      if (!user?.id) {
        setActiveSession(null);
        setMessages([]);
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      setError("");

      try {
        const session = await getOrCreateActiveChatSession({
          model: selectedModel,
          userId: user.id,
        });
        const databaseSessions = await refreshSessions(user.id);

        if (!isMounted) return;

        const sessionFromList =
          databaseSessions.find((item) => item.id === session.id) || session;

        setActiveSession(sessionFromList);
        setSelectedModel(sessionFromList.model || selectedModel);
        await loadSessionMessages(sessionFromList.id);
      } catch (sessionError) {
        if (!isMounted) return;

        setError(
          getChatPersistenceErrorMessage(sessionError) ||
            "Gagal memuat session dan history chat dari Supabase.",
        );
        setMessages([]);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    initializeChatSession();

    return () => {
      isMounted = false;
    };
  }, [loadSessionMessages, refreshSessions, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadPromptTemplates() {
      if (!user?.id) {
        setPromptTemplates([]);
        setIsPromptTemplateLoading(false);
        return;
      }

      setIsPromptTemplateLoading(true);

      try {
        const databasePromptTemplates = await getPromptTemplates(user.id);

        if (!isMounted) return;

        setPromptTemplates(databasePromptTemplates);
      } catch (templateError) {
        if (!isMounted) return;

        setError(
          getPromptTemplateErrorMessage(templateError) ||
            "Gagal memuat prompt template.",
        );
        setPromptTemplates([]);
      } finally {
        if (isMounted) {
          setIsPromptTemplateLoading(false);
        }
      }
    }

    loadPromptTemplates();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  async function selectSession(session) {
    if (isSending || isSessionActionLoading || session.id === activeSession?.id) {
      return;
    }

    setError("");
    setIsLoadingHistory(true);
    setActiveSession(session);
    setSelectedModel(session.model || "openrouter/auto");

    try {
      await loadSessionMessages(session.id);
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal memuat chat session.",
      );
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleNewChat() {
    if (!user?.id || isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);
    setIsLoadingHistory(true);

    try {
      const session = await createChatSession({
        model: selectedModel,
        title: "Percakapan Baru",
        userId: user.id,
      });

      const databaseSessions = await refreshSessions(user.id);
      const sessionFromList =
        databaseSessions.find((item) => item.id === session.id) || session;

      setActiveSession(sessionFromList);
      setMessages([]);
      setSearchQuery("");
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal membuat chat baru.",
      );
    } finally {
      setIsLoadingHistory(false);
      setIsSessionActionLoading(false);
    }
  }

  function openRenameDialog(session) {
    setRenameDialogSession(session);
    setRenameTitle(session.title);
  }

  function closeRenameDialog() {
    setRenameDialogSession(null);
    setRenameTitle("");
  }

  async function submitRenameSession(event) {
    event.preventDefault();

    const cleanTitle = renameTitle.trim();

    if (!renameDialogSession?.id || !cleanTitle || isSessionActionLoading) {
      return;
    }

    setError("");
    setIsSessionActionLoading(true);

    const previousSessions = sessions;
    const previousActiveSession = activeSession;
    const optimisticSession = {
      ...renameDialogSession,
      title: cleanTitle,
    };

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === optimisticSession.id ? optimisticSession : session,
      ),
    );

    if (activeSession?.id === optimisticSession.id) {
      setActiveSession(optimisticSession);
    }

    try {
      const renamedSession = await renameChatSession({
        sessionId: renameDialogSession.id,
        title: cleanTitle,
      });

      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === renamedSession.id ? renamedSession : session,
        ),
      );

      if (activeSession?.id === renamedSession.id) {
        setActiveSession(renamedSession);
      }

      closeRenameDialog();
    } catch (sessionError) {
      setSessions(previousSessions);
      setActiveSession(previousActiveSession);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal rename chat session.",
      );
    } finally {
      setIsSessionActionLoading(false);
    }
  }

  async function confirmDeleteSession() {
    if (!deleteDialogSession?.id || isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);
    setIsLoadingHistory(true);

    try {
      await deleteChatSession(deleteDialogSession.id);
      const remainingSessions = await refreshSessions(user.id);
      const currentSessionStillExists = remainingSessions.find(
        (item) => item.id === activeSession?.id,
      );
      const nextSession =
        deleteDialogSession.id === activeSession?.id
          ? remainingSessions[0] || null
          : currentSessionStillExists;

      if (nextSession) {
        setActiveSession(nextSession);
        setSelectedModel(nextSession.model || "openrouter/auto");
        await loadSessionMessages(nextSession.id);
      } else {
        const newSession = await createChatSession({
          model: selectedModel,
          title: "Percakapan Baru",
          userId: user.id,
        });
        await refreshSessions(user.id);
        setActiveSession(newSession);
        setMessages([]);
      }

      setSearchQuery("");
      setSessionSearchQuery("");
      setDeleteDialogSession(null);
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal menghapus chat session.",
      );
    } finally {
      setIsLoadingHistory(false);
      setIsSessionActionLoading(false);
    }
  }

  async function handleTogglePinSession(session) {
    if (isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);

    const previousSessions = sessions;
    const nextPinned = !session.pinned;

    setSessions((currentSessions) =>
      sortSessions(
        currentSessions.map((item) =>
          item.id === session.id ? { ...item, pinned: nextPinned } : item,
        ),
      ),
    );

    try {
      const pinnedSession = await togglePinChatSession({
        sessionId: session.id,
        pinned: nextPinned,
      });

      setSessions((currentSessions) =>
        sortSessions(
          currentSessions.map((item) =>
            item.id === pinnedSession.id ? pinnedSession : item,
          ),
        ),
      );

      if (activeSession?.id === pinnedSession.id) {
        setActiveSession(pinnedSession);
      }
    } catch (sessionError) {
      setSessions(previousSessions);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal mengubah status pin session.",
      );
    } finally {
      setIsSessionActionLoading(false);
    }
  }

  async function handleModelChange(nextModel) {
    const previousModel = selectedModel;
    const previousActiveSession = activeSession;
    const previousSessions = sessions;

    setSelectedModel(nextModel);

    if (!activeSession?.id || !user?.id) return;

    const optimisticSession = {
      ...activeSession,
      model: nextModel,
    };

    setActiveSession(optimisticSession);
    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === activeSession.id
          ? { ...session, model: nextModel }
          : session,
      ),
    );

    try {
      const updatedSession = await updateChatSessionModel({
        sessionId: activeSession.id,
        model: nextModel,
      });

      setActiveSession(updatedSession);
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
      );
    } catch (sessionError) {
      setSelectedModel(previousModel);
      setActiveSession(previousActiveSession);
      setSessions(previousSessions);
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal menyimpan model session.",
      );
    }
  }

  function openCreatePromptTemplateDialog() {
    setPromptTemplateDialogMode("create");
    setPromptTemplateDialogItem(null);
    setPromptTemplateForm(emptyPromptTemplateForm);
  }

  function openEditPromptTemplateDialog(template) {
    setPromptTemplateDialogMode("edit");
    setPromptTemplateDialogItem(template);
    setPromptTemplateForm({
      title: template.title,
      category: template.category || "Umum",
      prompt: template.prompt,
      isFavorite: Boolean(template.isFavorite),
    });
  }

  function closePromptTemplateDialog() {
    setPromptTemplateDialogMode("");
    setPromptTemplateDialogItem(null);
    setPromptTemplateForm(emptyPromptTemplateForm);
  }

  function updatePromptTemplateForm(field, value) {
    setPromptTemplateForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function submitPromptTemplate(event) {
    event.preventDefault();

    if (!user?.id || isPromptTemplateActionLoading) return;

    setError("");
    setIsPromptTemplateActionLoading(true);

    try {
      if (promptTemplateDialogMode === "edit" && promptTemplateDialogItem?.id) {
        const updatedTemplate = await updatePromptTemplate({
          id: promptTemplateDialogItem.id,
          userId: user.id,
          ...promptTemplateForm,
        });

        setPromptTemplates((currentTemplates) =>
          sortPromptTemplates(
            currentTemplates.map((template) =>
              template.id === updatedTemplate.id ? updatedTemplate : template,
            ),
          ),
        );
      } else {
        const createdTemplate = await createPromptTemplate({
          userId: user.id,
          ...promptTemplateForm,
        });

        setPromptTemplates((currentTemplates) =>
          sortPromptTemplates([createdTemplate, ...currentTemplates]),
        );
      }

      await refreshPromptTemplates(user.id);
      closePromptTemplateDialog();
    } catch (templateError) {
      setError(
        getPromptTemplateErrorMessage(templateError) ||
          "Gagal menyimpan prompt template.",
      );
    } finally {
      setIsPromptTemplateActionLoading(false);
    }
  }

  async function handleTogglePromptTemplateFavorite(template) {
    if (!user?.id || isPromptTemplateActionLoading) return;

    setError("");
    setIsPromptTemplateActionLoading(true);

    const previousPromptTemplates = promptTemplates;
    const nextFavorite = !template.isFavorite;

    setPromptTemplates((currentTemplates) =>
      sortPromptTemplates(
        currentTemplates.map((item) =>
          item.id === template.id
            ? { ...item, isFavorite: nextFavorite }
            : item,
        ),
      ),
    );

    try {
      const updatedTemplate = await togglePromptTemplateFavorite({
        id: template.id,
        isFavorite: nextFavorite,
        userId: user.id,
      });

      setPromptTemplates((currentTemplates) =>
        sortPromptTemplates(
          currentTemplates.map((item) =>
            item.id === updatedTemplate.id ? updatedTemplate : item,
          ),
        ),
      );
    } catch (templateError) {
      setPromptTemplates(previousPromptTemplates);
      setError(
        getPromptTemplateErrorMessage(templateError) ||
          "Gagal mengubah favorite prompt.",
      );
    } finally {
      setIsPromptTemplateActionLoading(false);
    }
  }

  async function confirmDeletePromptTemplate() {
    if (!user?.id || !deletePromptTemplateDialogItem?.id) return;

    setError("");
    setIsPromptTemplateActionLoading(true);

    try {
      await deletePromptTemplate({
        id: deletePromptTemplateDialogItem.id,
        userId: user.id,
      });

      setPromptTemplates((currentTemplates) =>
        currentTemplates.filter(
          (template) => template.id !== deletePromptTemplateDialogItem.id,
        ),
      );
      setDeletePromptTemplateDialogItem(null);
    } catch (templateError) {
      setError(
        getPromptTemplateErrorMessage(templateError) ||
          "Gagal menghapus prompt template.",
      );
    } finally {
      setIsPromptTemplateActionLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSending || !activeSession?.id) return;

    setPrompt("");
    setError("");
    setIsSending(true);

    try {
      await saveChatMessage({
        sessionId: activeSession.id,
        userId: user.id,
        role: "user",
        content: cleanPrompt,
        model: selectedModel,
      });
      await loadSessionMessages(activeSession.id);

      const data = await api.sendAiChat({
        message: cleanPrompt,
        model: selectedModel,
      });

      await saveChatMessage({
        sessionId: activeSession.id,
        userId: user.id,
        role: "assistant",
        content: data.response,
        model: selectedModel,
      });
      await loadSessionMessages(activeSession.id);
      await refreshSessions(user.id);
    } catch (chatError) {
      const message =
        getChatPersistenceErrorMessage(chatError) ||
        "Gagal mengambil jawaban AI dari OpenRouter.";

      setError(message);

      if (activeSession?.id) {
        await loadSessionMessages(activeSession.id).catch(() => undefined);
      }
    } finally {
      setIsSending(false);
    }
  }

  function useLibraryPrompt(libraryPrompt) {
    setPrompt(libraryPrompt);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
          <Bot size={23} />
        </span>
        <p className="mt-6 text-[10px] font-black tracking-[0.28em] text-cyan-300">
          AI OPERATIONS
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          AI Workspace Professional
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
          Workspace newsroom untuk multi-model AI, session chat permanen,
          riwayat Supabase, dan respons OpenRouter real-time.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Model Aktif"
          value={selectedModelLabel}
          icon={Sparkles}
        />
        <MetricCard
          label="Conversation"
          value={`${conversationCount} prompt`}
          icon={MessageSquare}
        />
        <MetricCard label="Mode" value="OpenRouter API" icon={Clock3} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="grid content-start gap-4">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  CHAT SESSION
                </p>
                <h3 className="mt-2 text-lg font-black text-white">
                  Workspace
                </h3>
              </div>
              <button
                className="inline-flex size-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSessionActionLoading}
                onClick={handleNewChat}
                title="New Chat"
                type="button"
              >
                <Plus size={17} />
              </button>
            </div>

            <div className="mt-4 grid max-h-[460px] gap-2 overflow-y-auto pr-1">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
                <Search size={15} />
                <input
                  className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                  onChange={(event) =>
                    setSessionSearchQuery(event.target.value)
                  }
                  placeholder="Cari session..."
                  value={sessionSearchQuery}
                />
              </label>

              {filteredSessions.map((session) => {
                const isActive = session.id === activeSession?.id;

                return (
                  <article
                    className={`rounded-2xl border p-3 transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    key={session.id}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        className="block min-w-0 flex-1 text-left"
                        disabled={isSessionActionLoading || isSending}
                        onClick={() => selectSession(session)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          {session.pinned && (
                            <Pin className="shrink-0 text-amber-300" size={13} />
                          )}
                          <span className="line-clamp-1 text-sm font-black text-white">
                            {session.title}
                          </span>
                        </span>
                        <span className="mt-1 block line-clamp-1 text-[10px] font-bold text-slate-500">
                          {session.model}
                        </span>
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-amber-300/30 hover:text-amber-200"
                        onClick={() => handleTogglePinSession(session)}
                        title={session.pinned ? "Unpin chat" : "Pin chat"}
                        type="button"
                      >
                        {session.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                        onClick={() => openRenameDialog(session)}
                        title="Rename chat"
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/5 text-rose-200 transition hover:bg-rose-300/10"
                        onClick={() => setDeleteDialogSession(session)}
                        title="Delete chat"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {sessions.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Session akan dibuat otomatis saat workspace dibuka.
                </p>
              )}
              {sessions.length > 0 && filteredSessions.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Session tidak ditemukan.
                </p>
              )}
            </div>
          </section>
        </aside>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
                CHAT WORKSPACE
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                {activeSession?.title || "Prompt Console"}
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(180px,240px)_minmax(180px,260px)]">
              <label className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                MODEL SELECTOR
                <select
                  className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  onChange={(event) => handleModelChange(event.target.value)}
                  value={selectedModel}
                >
                  {modelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                SEARCH HISTORY
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
                  <Search size={15} />
                  <input
                    className="w-full bg-transparent text-sm font-bold normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-600"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari prompt atau jawaban..."
                    value={searchQuery}
                  />
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 grid max-h-[520px] gap-4 overflow-y-auto pr-1">
            {isLoadingHistory && (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs font-bold text-cyan-200">
                Memuat history chat dari Supabase...
              </div>
            )}
            {!isLoadingHistory && messages.length === 0 && (
              <article className="mr-auto max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    AI Workspace
                  </p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                    System
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  Selamat datang di AI Workspace. Pilih model, tulis prompt,
                  lalu submit untuk menyimpan percakapan ke Supabase.
                </p>
              </article>
            )}
            {!isLoadingHistory && messages.length > 0 && filteredMessages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-slate-400">
                Tidak ada message yang cocok dengan pencarian.
              </div>
            )}
            {filteredMessages.map((message) => (
              <article
                className={`rounded-2xl border p-4 ${
                  message.role === "user"
                    ? "ml-auto max-w-2xl border-cyan-300/20 bg-cyan-300/10"
                    : "mr-auto max-w-2xl border-white/10 bg-black/20"
                }`}
                key={message.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    {message.role === "user" ? "Operator" : "AI Workspace"}
                  </p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                    {modelOptions.find((model) => model.value === message.model)
                      ?.label || message.model}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {message.content}
                </p>
              </article>
            ))}
          </div>

          <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
            {isSending && (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs font-bold text-cyan-200">
                Menghubungi OpenRouter API...
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-xs font-bold text-rose-200">
                {error}
              </div>
            )}
            <textarea
              className="min-h-36 resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Tulis prompt untuk berita, transkrip audio, gambar AI, atau audit naskah..."
              value={prompt}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                History tersimpan di Supabase sesuai user login. Jawaban AI
                diproses real-time lewat OpenRouter API.
              </p>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  !prompt.trim() ||
                  isSending ||
                  isLoadingHistory ||
                  !activeSession?.id
                }
                type="submit"
              >
                {isSending ? "Mengirim..." : "Submit Prompt"}
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>

        <aside className="grid gap-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Library className="text-cyan-300" size={18} />
                <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                  PROMPT LIBRARY
                </p>
              </div>
              <button
                className="inline-flex size-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!user?.id || isPromptTemplateActionLoading}
                onClick={openCreatePromptTemplateDialog}
                title="Add Prompt"
                type="button"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-cyan-300/40">
                <Search size={15} />
                <input
                  className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                  onChange={(event) =>
                    setPromptTemplateSearchQuery(event.target.value)
                  }
                  placeholder="Cari prompt..."
                  value={promptTemplateSearchQuery}
                />
              </label>
              <select
                className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-xs font-bold text-slate-100 outline-none transition focus:border-cyan-300/40"
                onChange={(event) =>
                  setPromptTemplateCategory(event.target.value)
                }
                value={promptTemplateCategory}
              >
                {promptTemplateCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
              {isPromptTemplateLoading && (
                <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-xs font-bold text-cyan-200">
                  Memuat prompt template...
                </p>
              )}
              {!isPromptTemplateLoading &&
                filteredPromptTemplates.map((template) => (
                  <article
                    className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                    key={template.id}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => useLibraryPrompt(template.prompt)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="line-clamp-1 text-sm font-black text-white">
                            {template.title}
                          </h4>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                            {template.category}
                          </p>
                        </div>
                        {template.isFavorite && (
                          <Star
                            className="shrink-0 fill-amber-300 text-amber-300"
                            size={15}
                          />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                        {template.prompt}
                      </p>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-amber-300/30 hover:text-amber-200"
                        disabled={isPromptTemplateActionLoading}
                        onClick={() =>
                          handleTogglePromptTemplateFavorite(template)
                        }
                        title={
                          template.isFavorite
                            ? "Hapus Favorite"
                            : "Favorite Prompt"
                        }
                        type="button"
                      >
                        <Star
                          className={
                            template.isFavorite
                              ? "fill-amber-300 text-amber-300"
                              : ""
                          }
                          size={14}
                        />
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                        disabled={isPromptTemplateActionLoading}
                        onClick={() => openEditPromptTemplateDialog(template)}
                        title="Edit Prompt"
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/5 text-rose-200 transition hover:bg-rose-300/10"
                        disabled={isPromptTemplateActionLoading}
                        onClick={() => setDeletePromptTemplateDialogItem(template)}
                        title="Delete Prompt"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              {!isPromptTemplateLoading && promptTemplates.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Belum ada prompt template. Tambahkan prompt untuk workflow
                  newsroom yang sering dipakai.
                </p>
              )}
              {!isPromptTemplateLoading &&
                promptTemplates.length > 0 &&
                filteredPromptTemplates.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                    Prompt template tidak ditemukan.
                  </p>
                )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
              CONVERSATION HISTORY
            </p>
            <div className="mt-4 grid gap-3">
              {messages
                .filter((message) => message.role === "user")
                .map((message, index) => (
                  <article
                    className="rounded-2xl border border-white/10 bg-black/15 p-3"
                    key={message.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-300">
                        Prompt #{index + 1}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-300">
                        {modelOptions.find((model) => model.value === message.model)
                          ?.label || message.model}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                      {message.content}
                    </p>
                  </article>
                ))}
              {conversationCount === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Belum ada prompt. Submit prompt pertama untuk membuat history.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>

      {renameDialogSession && (
        <SessionModal
          actionLabel="Simpan"
          isLoading={isSessionActionLoading}
          onClose={closeRenameDialog}
          onSubmit={submitRenameSession}
          title="Rename Session"
        >
          <label className="grid gap-2 text-xs font-bold text-slate-400">
            Nama session
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setRenameTitle(event.target.value)}
              value={renameTitle}
            />
          </label>
        </SessionModal>
      )}

      {deleteDialogSession && (
        <SessionModal
          actionLabel="Hapus"
          danger
          isLoading={isSessionActionLoading}
          onClose={() => setDeleteDialogSession(null)}
          onSubmit={(event) => {
            event.preventDefault();
            confirmDeleteSession();
          }}
          title="Delete Session"
        >
          <p className="text-sm leading-6 text-slate-300">
            Hapus chat "{deleteDialogSession.title}" dan semua message di
            dalamnya?
          </p>
        </SessionModal>
      )}

      {promptTemplateDialogMode && (
        <SessionModal
          actionLabel={
            promptTemplateDialogMode === "edit" ? "Simpan" : "Tambah"
          }
          isLoading={isPromptTemplateActionLoading}
          onClose={closePromptTemplateDialog}
          onSubmit={submitPromptTemplate}
          title={
            promptTemplateDialogMode === "edit"
              ? "Edit Prompt"
              : "Add Prompt"
          }
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-xs font-bold text-slate-400">
              Judul prompt
              <input
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                onChange={(event) =>
                  updatePromptTemplateForm("title", event.target.value)
                }
                value={promptTemplateForm.title}
              />
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-400">
              Category
              <input
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                onChange={(event) =>
                  updatePromptTemplateForm("category", event.target.value)
                }
                value={promptTemplateForm.category}
              />
            </label>
            <label className="grid gap-2 text-xs font-bold text-slate-400">
              Isi prompt
              <textarea
                className="min-h-40 resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-300/40"
                onChange={(event) =>
                  updatePromptTemplateForm("prompt", event.target.value)
                }
                value={promptTemplateForm.prompt}
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-slate-300">
              <input
                checked={promptTemplateForm.isFavorite}
                className="size-4 accent-cyan-300"
                onChange={(event) =>
                  updatePromptTemplateForm("isFavorite", event.target.checked)
                }
                type="checkbox"
              />
              Favorite Prompt
            </label>
          </div>
        </SessionModal>
      )}

      {deletePromptTemplateDialogItem && (
        <SessionModal
          actionLabel="Hapus"
          danger
          isLoading={isPromptTemplateActionLoading}
          onClose={() => setDeletePromptTemplateDialogItem(null)}
          onSubmit={(event) => {
            event.preventDefault();
            confirmDeletePromptTemplate();
          }}
          title="Delete Prompt"
        >
          <p className="text-sm leading-6 text-slate-300">
            Hapus prompt "{deletePromptTemplateDialogItem.title}" dari library?
          </p>
        </SessionModal>
      )}
    </div>
  );
}

function sortSessions(sessionList) {
  return [...sessionList].sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  });
}

function sortPromptTemplates(templateList) {
  return [...templateList].sort((first, second) => {
    if (first.isFavorite !== second.isFavorite) {
      return first.isFavorite ? -1 : 1;
    }

    return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
  });
}

function SessionModal({
  actionLabel,
  children,
  danger = false,
  isLoading,
  onClose,
  onSubmit,
  title,
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <form
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#080d16] p-5 shadow-2xl shadow-black/50"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button
            className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-black text-slate-300"
            onClick={onClose}
            type="button"
          >
            Batal
          </button>
          <button
            className={`rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "border-rose-300/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                : "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/20"
            }`}
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Memproses..." : actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="text-cyan-300" size={18} />
      <p className="mt-4 text-[10px] font-black tracking-[0.18em] text-slate-500">
        {label.toUpperCase()}
      </p>
      <h3 className="mt-2 text-lg font-black text-white">{value}</h3>
    </article>
  );
}
