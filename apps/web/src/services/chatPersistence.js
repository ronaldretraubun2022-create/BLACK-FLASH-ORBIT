import { supabase } from "../lib/supabase";

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
    message.includes("model") &&
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
    .order("created_at", { ascending: false });

  if (error) throw error;

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

export async function renameChatSession({ sessionId, title }) {
  const client = requireSupabase();
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Nama chat tidak boleh kosong.");
  }

  const { data, error } = await client
    .from("chat_sessions")
    .update({ title: cleanTitle })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) throw error;

  return normalizeSession(data);
}

export async function deleteChatSession(sessionId) {
  const client = requireSupabase();

  const { error: messagesError } = await client
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId);

  if (messagesError) throw messagesError;

  const { error } = await client
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
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

export async function saveChatMessage({ content, model, role, sessionId }) {
  const client = requireSupabase();
  const messagePayload = {
    session_id: sessionId,
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
      .insert([messagePayload])
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
