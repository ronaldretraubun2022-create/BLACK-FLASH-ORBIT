import { supabase } from "../lib/supabase";
import { api } from "./api";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan AI Workspace";
const SCHEMA_SYNC_MESSAGE =
  "Schema chat belum sinkron. Jalankan SQL migration model chat, lalu refresh Supabase schema cache.";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  return supabase;
}

function normalizeMessage(message) {
  return {
    id: message.id,
    sessionId: message.session_id,
    role: message.role,
    model: message.model || DEFAULT_MODEL,
    content: message.content,
    createdAt: message.created_at,
  };
}

function isModelSchemaError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${
    error?.hint || ""
  }`;

  return (
    error?.code === "PGRST204" &&
    (message.includes("model") ||
      message.includes("pinned") ||
      message.includes("user_id")) &&
    (message.includes("schema cache") || message.includes("column"))
  );
}

function getFriendlyError(error) {
  if (isModelSchemaError(error)) {
    return new Error(SCHEMA_SYNC_MESSAGE);
  }

  return error;
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

export async function getChatSessions(userId) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (!isModelSchemaError(error)) throw error;

    const { data: fallbackData, error: fallbackError } = await client
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fallbackError) throw getFriendlyError(fallbackError);

    return (fallbackData || []).map(normalizeSession);
  }

  return (data || []).map(normalizeSession);
}

export async function createChatSession({ model, title, userId }) {
  const client = requireSupabase();
  const sessionPayload = {
    user_id: userId,
    title: title || DEFAULT_SESSION_TITLE,
  };

  const { data: newSession, error: insertError } = await client
    .from("chat_sessions")
    .insert([
      {
        ...sessionPayload,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (insertError) {
    if (!isModelSchemaError(insertError)) {
      throw getFriendlyError(insertError);
    }

    const { data: fallbackSession, error: fallbackError } = await client
      .from("chat_sessions")
      .insert([sessionPayload])
      .select("*")
      .single();

    if (fallbackError) throw getFriendlyError(fallbackError);

    return normalizeSession(fallbackSession);
  }

  return normalizeSession(newSession);
}

export async function getOrCreateActiveChatSession({ model, userId }) {
  const sessions = await getChatSessions(userId);

  if (sessions.length > 0) return sessions[0];

  return createChatSession({
    model,
    title: DEFAULT_SESSION_TITLE,
    userId,
  });
}

async function getAccessToken() {
  const client = requireSupabase();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;

  if (session?.access_token) {
    return session.access_token;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await client.auth.refreshSession();

  if (refreshError) throw refreshError;

  if (refreshedSession?.access_token) {
    return refreshedSession.access_token;
  }

  throw new Error(
    "Access token login tidak tersedia. Silakan logout lalu login ulang.",
  );
}

export async function renameChatSession({ sessionId, title }) {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Nama chat tidak boleh kosong.");
  }

  const accessToken = await getAccessToken();
  const response = await api.renameChatSession({
    accessToken,
    sessionId,
    title: cleanTitle,
  });

  return normalizeSession(response.data);
}

export async function deleteChatSession(sessionId) {
  const accessToken = await getAccessToken();

  const response = await api.deleteChatSession({
    accessToken,
    sessionId,
  });

  return response.data;
}

export async function togglePinChatSession({ pinned, sessionId }) {
  const accessToken = await getAccessToken();
  const response = await api.togglePinChatSession({
    accessToken,
    pinned,
    sessionId,
  });

  return normalizeSession(response.data);
}

export async function getChatMessages(sessionId) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map(normalizeMessage);
}

export async function saveChatMessage({
  content,
  model,
  role,
  sessionId,
  userId,
}) {
  const client = requireSupabase();
  const messagePayload = {
    session_id: sessionId,
    user_id: userId,
    role,
    content,
  };

  const { data, error } = await client
    .from("chat_messages")
    .insert([
      {
        ...messagePayload,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (error) {
    if (!isModelSchemaError(error)) {
      throw getFriendlyError(error);
    }

    const { data: fallbackMessage, error: fallbackError } = await client
      .from("chat_messages")
      .insert([
        {
          session_id: sessionId,
          role,
          content,
        },
      ])
      .select("*")
      .single();

    if (fallbackError) throw getFriendlyError(fallbackError);

    return normalizeMessage(fallbackMessage);
  }

  return normalizeMessage(data);
}

export function getChatPersistenceErrorMessage(error) {
  return getFriendlyError(error).message || "Gagal memproses data chat.";
}
