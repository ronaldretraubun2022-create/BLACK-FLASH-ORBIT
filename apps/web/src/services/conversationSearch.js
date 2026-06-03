import { supabase } from "../lib/supabase";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan AI Workspace";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  return supabase;
}

function normalizeSession(session) {
  return {
    id: session.id,
    userId: session.user_id,
    title: session.title || DEFAULT_SESSION_TITLE,
    model: session.model || DEFAULT_MODEL,
    pinned: Boolean(session.pinned),
    createdAt: session.created_at,
    updatedAt: session.updated_at || session.created_at,
  };
}

function normalizeMessageResult(message, session) {
  return {
    id: `message:${message.id}`,
    type: "message",
    role: message.role,
    snippet: message.content || "",
    createdAt: message.created_at,
    session,
  };
}

function normalizeSessionResult(session) {
  return {
    id: `session:${session.id}`,
    type: "session",
    role: "session",
    snippet: session.title || DEFAULT_SESSION_TITLE,
    createdAt: session.created_at,
    session: normalizeSession(session),
  };
}

export async function searchConversations({ query, userId }) {
  const client = requireSupabase();
  const cleanQuery = typeof query === "string" ? query.trim() : "";

  if (!userId) {
    throw new Error("User login wajib tersedia untuk search conversation.");
  }

  if (!cleanQuery) return [];

  const likeQuery = `%${cleanQuery.replace(/[%_]/g, "\\$&")}%`;

  const [{ data: sessionRows, error: sessionError }, { data: messageRows, error: messageError }] =
    await Promise.all([
      client
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .ilike("title", likeQuery)
        .limit(12),
      client
        .from("chat_messages")
        .select("id, session_id, role, content, model, created_at")
        .eq("user_id", userId)
        .ilike("content", likeQuery)
        .order("created_at", { ascending: false })
        .limit(24),
    ]);

  if (sessionError) throw sessionError;
  if (messageError) throw messageError;

  const sessionResults = (sessionRows || []).map(normalizeSessionResult);
  const messageSessionIds = Array.from(
    new Set((messageRows || []).map((message) => message.session_id).filter(Boolean)),
  );
  const sessionById = new Map(
    (sessionRows || []).map((session) => [session.id, normalizeSession(session)]),
  );

  if (messageSessionIds.length > 0) {
    const missingSessionIds = messageSessionIds.filter(
      (sessionId) => !sessionById.has(sessionId),
    );

    if (missingSessionIds.length > 0) {
      const { data: messageSessions, error: messageSessionsError } = await client
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .in("id", missingSessionIds);

      if (messageSessionsError) throw messageSessionsError;

      (messageSessions || []).forEach((session) => {
        sessionById.set(session.id, normalizeSession(session));
      });
    }
  }

  const messageResults = (messageRows || [])
    .map((message) => {
      const session = sessionById.get(message.session_id);

      if (!session) return null;

      return normalizeMessageResult(message, session);
    })
    .filter(Boolean);

  return [...sessionResults, ...messageResults].sort(
    (first, second) =>
      new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
  );
}

export function getConversationSearchErrorMessage(error) {
  return error?.message || "Gagal search conversation.";
}
