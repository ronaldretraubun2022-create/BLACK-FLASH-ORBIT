const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan Baru";

let supabaseClient = null;
let supabaseClientKey = "";

function normalizeOptionalText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  return trimmed || fallback;
}

function createRouteError(message, code, statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getSupabaseAdminConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw createRouteError(
      "Supabase environment belum lengkap.",
      "SUPABASE_ENV_MISSING",
    );
  }

  return { supabaseKey, supabaseUrl };
}

function getSupabaseClient() {
  const { supabaseKey, supabaseUrl } = getSupabaseAdminConfig();
  const nextClientKey = `${supabaseUrl}:${supabaseKey.slice(0, 8)}`;

  if (!supabaseClient || supabaseClientKey !== nextClientKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    supabaseClientKey = nextClientKey;
  }

  return supabaseClient;
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw createRouteError(
      "Authorization Bearer token wajib dikirim.",
      "AUTH_REQUIRED",
      401,
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw createRouteError(
      "Authorization Bearer token tidak valid.",
      "AUTH_REQUIRED",
      401,
    );
  }

  return token;
}

function getRequestSupabaseClient(req) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authorization = req.headers.authorization || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createRouteError(
      "SUPABASE_URL dan SUPABASE_ANON_KEY wajib untuk route user-scoped.",
      "SUPABASE_ENV_MISSING",
    );
  }

  getBearerToken(req);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
}

async function getAuthenticatedUser(supabase, req) {
  const token = getBearerToken(req);
  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    throw createRouteError(
      "Session login tidak aktif. Silakan login ulang.",
      "AUTH_INVALID",
      401,
    );
  }

  if (!data?.user?.id) {
    throw createRouteError(
      "Session login tidak aktif. Silakan login ulang.",
      "AUTH_REQUIRED",
      401,
    );
  }

  return data.user;
}

function sendError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || error.status || 500;

  return res.status(statusCode).json({
    success: false,
    error: error.message || fallbackMessage,
    code: error.code || null,
  });
}

router.get("/sessions", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat sessions.");
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const title = normalizeOptionalText(req.body?.title, DEFAULT_SESSION_TITLE);
    const model = normalizeOptionalText(req.body?.model, DEFAULT_MODEL);

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([{ title, model }])
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Gagal membuat chat session.");
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const supabase = getRequestSupabaseClient(req);
    const user = await getAuthenticatedUser(supabase, req);
    const sessionId = normalizeOptionalText(req.params?.id);
    const title = normalizeOptionalText(req.body?.title);

    if (!sessionId || !title) {
      throw createRouteError(
        "session id dan title wajib diisi.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createRouteError(
        "Chat session tidak ditemukan atau bukan milik user login.",
        "SESSION_NOT_FOUND",
        404,
      );
    }

    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Gagal rename chat session.");
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const supabase = getRequestSupabaseClient(req);
    const user = await getAuthenticatedUser(supabase, req);
    const sessionId = normalizeOptionalText(req.params?.id);

    if (!sessionId) {
      throw createRouteError(
        "session id wajib diisi.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!session) {
      throw createRouteError(
        "Chat session tidak ditemukan atau bukan milik user login.",
        "SESSION_NOT_FOUND",
        404,
      );
    }

    const { error: messagesError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if (messagesError) throw messagesError;

    const { error: sessionDeleteError } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (sessionDeleteError) throw sessionDeleteError;

    return res.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus chat session.");
  }
});

router.post("/sessions/:id/pin", async (req, res) => {
  try {
    const supabase = getRequestSupabaseClient(req);
    const user = await getAuthenticatedUser(supabase, req);
    const sessionId = normalizeOptionalText(req.params?.id);
    const pinned = Boolean(req.body?.pinned);

    if (!sessionId) {
      throw createRouteError(
        "session id wajib diisi.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .update({ pinned })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createRouteError(
        "Chat session tidak ditemukan atau bukan milik user login.",
        "SESSION_NOT_FOUND",
        404,
      );
    }

    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Gagal mengubah status pin session.");
  }
});

router.get("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const sessionId = normalizeOptionalText(req.query?.session_id);

    let query = supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat messages.");
  }
});

router.post("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const sessionId = normalizeOptionalText(req.body?.session_id);
    const role = normalizeOptionalText(req.body?.role);
    const content = normalizeOptionalText(req.body?.content);
    const model = normalizeOptionalText(req.body?.model, DEFAULT_MODEL);

    if (!sessionId || !role || !content) {
      throw createRouteError(
        "session_id, role, dan content wajib diisi.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert([{ session_id: sessionId, role, content, model }])
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Gagal menyimpan chat message.");
  }
});

module.exports = router;
