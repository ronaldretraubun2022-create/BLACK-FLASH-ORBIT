const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan Baru";

let adminClient = null;
let adminClientKey = "";

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function createHttpError(message, statusCode = 500, code = "SERVER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw createHttpError(
      "Supabase environment belum lengkap.",
      500,
      "SUPABASE_ENV_MISSING",
    );
  }

  return { supabaseUrl, supabaseKey };
}

function getSupabaseClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  const nextKey = `${supabaseUrl}:${supabaseKey.slice(0, 12)}`;

  if (!adminClient || adminClientKey !== nextKey) {
    adminClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    adminClientKey = nextKey;
  }

  return adminClient;
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
      .limit(50);

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat sessions.");
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const title = normalizeText(req.body?.title, DEFAULT_SESSION_TITLE);
    const model = normalizeText(req.body?.model, DEFAULT_MODEL);
    const userId = normalizeText(req.body?.user_id || req.body?.userId);

    const payload = {
      title,
      model,
      pinned: false,
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, "Gagal membuat chat session.");
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const sessionId = normalizeText(req.params?.id);
    const title = normalizeText(req.body?.title);

    if (!sessionId || !title) {
      throw createHttpError(
        "session id dan title wajib diisi.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", sessionId)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createHttpError(
        "Chat session tidak ditemukan.",
        404,
        "SESSION_NOT_FOUND",
      );
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, "Gagal rename chat session.");
  }
});

router.post("/sessions/:id/pin", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const sessionId = normalizeText(req.params?.id);
    const pinned = Boolean(req.body?.pinned);

    if (!sessionId) {
      throw createHttpError("session id wajib diisi.", 400, "VALIDATION_ERROR");
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .update({ pinned })
      .eq("id", sessionId)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createHttpError(
        "Chat session tidak ditemukan.",
        404,
        "SESSION_NOT_FOUND",
      );
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengubah status pin session.");
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const sessionId = normalizeText(req.params?.id);

    if (!sessionId) {
      throw createHttpError("session id wajib diisi.", 400, "VALIDATION_ERROR");
    }

    const { error: messagesError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);

    if (messagesError) throw messagesError;

    const { error: sessionError } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId);

    if (sessionError) throw sessionError;

    return res.json({
      success: true,
      data: { id: sessionId },
    });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus chat session.");
  }
});

router.get("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const sessionId = normalizeText(req.query?.session_id);

    let query = supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query.limit(200);

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat messages.");
  }
});

router.post("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const sessionId = normalizeText(req.body?.session_id);
    const userId = normalizeText(req.body?.user_id || req.body?.userId);
    const role = normalizeText(req.body?.role);
    const content = normalizeText(req.body?.content);
    const model = normalizeText(req.body?.model, DEFAULT_MODEL);

    if (!sessionId || !role || !content) {
      throw createHttpError(
        "session_id, role, dan content wajib diisi.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const payload = {
      session_id: sessionId,
      role,
      content,
      model,
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, "Gagal menyimpan chat message.");
  }
});

module.exports = router;
