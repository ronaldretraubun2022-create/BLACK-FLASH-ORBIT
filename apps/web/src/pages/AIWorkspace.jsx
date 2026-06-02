import { useMemo, useState } from "react";
import {
  Bot,
  Clock3,
  Library,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";

const modelOptions = ["OpenAI", "Gemini", "Anthropic", "OpenRouter"];

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

function createLocalResponse(prompt, model) {
  return `Draft lokal siap diproses dengan ${model}. Integrasi API AI belum aktif, tetapi prompt sudah masuk ke conversation history: "${prompt.slice(
    0,
    120,
  )}${prompt.length > 120 ? "..." : ""}"`;
}

export function AIWorkspace() {
  const [selectedModel, setSelectedModel] = useState("OpenAI");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      model: "System",
      content:
        "Selamat datang di AI Workspace. Pilih model, tulis prompt, lalu submit untuk menyimpan percakapan lokal.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const conversationCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

  function handleSubmit(event) {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;

    const timestamp = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      model: selectedModel,
      content: cleanPrompt,
      createdAt: timestamp,
    };
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      model: selectedModel,
      content: createLocalResponse(cleanPrompt, selectedModel),
      createdAt: timestamp,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ]);
    setPrompt("");
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
          AI Workspace
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
          Modul MVP untuk menyusun prompt, memilih model AI, dan menyimpan
          riwayat percakapan lokal sebelum integrasi API produksi.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Model Aktif" value={selectedModel} icon={Sparkles} />
        <MetricCard
          label="Conversation"
          value={`${conversationCount} prompt`}
          icon={MessageSquare}
        />
        <MetricCard label="Mode" value="Local MVP" icon={Clock3} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
                CHAT WORKSPACE
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                Prompt Console
              </h3>
            </div>

            <label className="grid gap-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
              MODEL SELECTOR
              <select
                className="min-w-44 rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setSelectedModel(event.target.value)}
                value={selectedModel}
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid max-h-[520px] gap-4 overflow-y-auto pr-1">
            {messages.map((message) => (
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
                    {message.model}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {message.content}
                </p>
              </article>
            ))}
          </div>

          <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
            <textarea
              className="min-h-36 resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Tulis prompt untuk berita, transkrip audio, gambar AI, atau audit naskah..."
              value={prompt}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                History disimpan sementara di local state. API AI belum
                dihubungkan.
              </p>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!prompt.trim()}
                type="submit"
              >
                Submit Prompt
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
                        {message.model}
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
