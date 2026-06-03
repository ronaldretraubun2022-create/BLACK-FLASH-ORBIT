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

export async function getOrCreateActiveChatSession({ model, userId }) {
  const client = requireSupabase();

  const { data: existingSession, error: selectError } = await client
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existingSession) return existingSession;

  const { data: newSession, error: insertError } = await client
    .from("chat_sessions")
    .insert([
      {
        user_id: userId,
        title: DEFAULT_SESSION_TITLE,
        model: model || DEFAULT_MODEL,
      },
    ])
    .select("*")
    .single();

  if (insertError) throw insertError;

  return newSession;
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
