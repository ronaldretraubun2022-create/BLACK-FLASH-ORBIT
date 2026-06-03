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

async function getCurrentUserId() {
  const client = requireSupabase();

  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return userId;
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

export async function getChatSessions(userId) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw getFriendlyError(error);

  return (data || []).map(normalizeSession);
}

export async function createChatSession({ model, title, userId }) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("chat_sessions")
    .insert([
      {
        user_id: userId,
        title: title || DEFAULT_SESSION_TITLE,
        model: model || DEFAULT_MODEL,
        pinned: false,
      },
    ])
    .select("*")
    .single();

  if (error) throw getFriendlyError(error);

  return normalizeSession(data);
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
  const userId = await getCurrentUserId();
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Nama chat tidak boleh kosong.");
  }

  const { data, error } = await client
    .from("chat_sessions")
    .update({ title: cleanTitle })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function deleteChatSession(sessionId) {
  const client = requireSupabase();
  const userId = await getCurrentUserId();

  const { error: messagesError } = await client
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (messagesError) throw getFriendlyError(messagesError);

  const { error: sessionError } = await client
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (sessionError) throw getFriendlyError(sessionError);

  return { id: sessionId };
}

export async function togglePinChatSession({ pinned, sessionId }) {
  const client = requireSupabase();
  const userId = await getCurrentUserId();

  const { data, error } = await client
    .from("chat_sessions")
    .update({ pinned: Boolean(pinned) })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function updateChatSessionModel({ model, sessionId }) {
  const client = requireSupabase();
  const userId = await getCurrentUserId();
  const nextModel =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL;

  const { data, error } = await client
    .from("chat_sessions")
    .update({ model: nextModel })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function getChatMessages(sessionId) {
  const client = requireSupabase();

  const { data, error } = await client
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw getFriendlyError(error);

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

  const { data, error } = await client
    .from("chat_messages")
    .insert([
      {
        session_id: sessionId,
        user_id: userId,
        role,
        content,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (error) throw getFriendlyError(error);

  return normalizeMessage(data);
}

export function getChatPersistenceErrorMessage(error) {
  return getFriendlyError(error).message || "Gagal memproses data chat.";
}
