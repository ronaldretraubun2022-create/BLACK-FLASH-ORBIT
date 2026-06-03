import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Clock3,
  Library,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
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
} from "../services/chatPersistence";

const modelOptions = [
  { label: "OpenRouter Auto", value: "openrouter/auto" },
  { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
  { label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
  { label: "Claude 3.5 Haiku", value: "anthropic/claude-3.5-haiku" },
  { label: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
];

const promptLibrary = [
  {
    title: "Generate Berita Cepat",
    prompt:
      "Buat berita profesional Indonesia dengan struktur Judul, Lead, Isi, Kutipan, dan Penutup berdasarkan catatan berikut:",
  },
  {
    title: "Ringkas Transkrip",
    prompt:
      "Ringkas transkrip wawancara ini menjadi poin berita utama, kutipan penting, dan konteks tambahan:",
  },
  {
    title: "Prompt Gambar Berita",
    prompt:
      "Buat prompt gambar cinematic ultra realistic untuk visual berita dengan detail kamera, lighting, texture, composition, dan mood:",
  },
  {
    title: "Audit Naskah",
    prompt:
      "Audit naskah berita berikut. Periksa akurasi gaya jurnalistik, struktur, nada, dan potensi bahasa generik AI:",
  },
];

export function AIWorkspace() {
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] = useState("openrouter/auto");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
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

  const loadSessionMessages = useCallback(async (sessionId) => {
    const databaseMessages = await getChatMessages(sessionId);
    setMessages(databaseMessages);
  }, []);

  const refreshSessions = useCallback(async (userId) => {
    const databaseSessions = await getChatSessions(userId);
    setSessions(databaseSessions);
    return databaseSessions;
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

  function startRenameSession(session) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function cancelRenameSession() {
    setEditingSessionId("");
    setEditingTitle("");
  }

  async function submitRenameSession(event) {
    event.preventDefault();

    if (!editingSessionId || isSessionActionLoading) return;

    setError("");
    setIsSessionActionLoading(true);

    try {
      const renamedSession = await renameChatSession({
        sessionId: editingSessionId,
        title: editingTitle,
      });

      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === renamedSession.id ? renamedSession : session,
        ),
      );

      if (activeSession?.id === renamedSession.id) {
        setActiveSession(renamedSession);
      }

      cancelRenameSession();
    } catch (sessionError) {
      setError(
        getChatPersistenceErrorMessage(sessionError) ||
          "Gagal rename chat session.",
      );
    } finally {
      setIsSessionActionLoading(false);
    }
  }

  async function handleDeleteSession(session) {
    if (isSessionActionLoading) return;

    const isConfirmed = window.confirm(
      `Hapus chat "${session.title}" dan semua message di dalamnya?`,
    );

    if (!isConfirmed) return;

    setError("");
    setIsSessionActionLoading(true);
    setIsLoadingHistory(true);

    try {
      await deleteChatSession(session.id);
      const remainingSessions = await refreshSessions(user.id);
      const currentSessionStillExists = remainingSessions.find(
        (item) => item.id === activeSession?.id,
      );
      const nextSession =
        session.id === activeSession?.id
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
    setPrompt((currentPrompt) =>
      currentPrompt ? `${currentPrompt}\n\n${libraryPrompt}` : libraryPrompt,
    );
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
              {sessions.map((session) => {
                const isActive = session.id === activeSession?.id;
                const isEditing = session.id === editingSessionId;

                return (
                  <article
                    className={`rounded-2xl border p-3 transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    key={session.id}
                  >
                    {isEditing ? (
                      <form
                        className="grid gap-2"
                        onSubmit={submitRenameSession}
                      >
                        <input
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-300/40"
                          onChange={(event) =>
                            setEditingTitle(event.target.value)
                          }
                          value={editingTitle}
                        />
                        <div className="flex gap-2">
                          <button
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                            disabled={isSessionActionLoading}
                            title="Simpan rename"
                            type="submit"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300"
                            onClick={cancelRenameSession}
                            title="Batal rename"
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          className="block w-full text-left"
                          disabled={isSessionActionLoading || isSending}
                          onClick={() => selectSession(session)}
                          type="button"
                        >
                          <span className="line-clamp-1 text-sm font-black text-white">
                            {session.title}
                          </span>
                          <span className="mt-1 block line-clamp-1 text-[10px] font-bold text-slate-500">
                            {session.model}
                          </span>
                        </button>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                            onClick={() => startRenameSession(session)}
                            title="Rename chat"
                            type="button"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/5 text-rose-200 transition hover:bg-rose-300/10"
                            onClick={() => handleDeleteSession(session)}
                            title="Delete chat"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {sessions.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
                  Session akan dibuat otomatis saat workspace dibuka.
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
                  onChange={(event) => setSelectedModel(event.target.value)}
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
            <div className="flex items-center gap-2">
              <Library className="text-cyan-300" size={18} />
              <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
                PROMPT LIBRARY
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {promptLibrary.map((item) => (
                <button
                  className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                  key={item.title}
                  onClick={() => useLibraryPrompt(item.prompt)}
                  type="button"
                >
                  <h4 className="text-sm font-black text-white">
                    {item.title}
                  </h4>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                    {item.prompt}
                  </p>
                </button>
              ))}
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
