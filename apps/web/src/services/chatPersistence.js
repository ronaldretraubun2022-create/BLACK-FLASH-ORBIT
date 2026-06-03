import { supabase } from "../lib/supabase";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan AI Workspace";

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

  const { data: newSession, error: insertError } = await client
    .from("chat_sessions")
    .insert([
      {
        user_id: userId,
        title: title || DEFAULT_SESSION_TITLE,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (insertError) throw insertError;

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

  const { data, error } = await client
    .from("chat_messages")
    .insert([
      {
        session_id: sessionId,
        role,
        content,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (error) throw error;

  return normalizeMessage(data);
}
