const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan Baru";
const SCHEMA_SYNC_MESSAGE =
  "Schema chat belum sinkron. Jalankan SQL migration model chat, lalu refresh Supabase schema cache.";

let supabaseClient = null;
let supabaseClientKey = "";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing = [];

    if (!supabaseUrl) {
      missing.push("SUPABASE_URL atau VITE_SUPABASE_URL");
    }

    if (!supabaseKey) {
      missing.push(
        "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, atau VITE_SUPABASE_ANON_KEY",
      );
    }

    const error = new Error(`Env hilang: ${missing.join("; ")}`);
    error.code = "SUPABASE_ENV_MISSING";
    throw error;
  }

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

function normalizeOptionalText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function sendSupabaseError(res, error, fallbackMessage) {
  if (error.code === "SUPABASE_ENV_MISSING") {
    return res.status(500).json({
      success: false,
      message: "Supabase environment belum lengkap",
      error: error.message,
    });
  }

  if (isModelSchemaError(error)) {
    return res.status(500).json({
      success: false,
      message: SCHEMA_SYNC_MESSAGE,
      code: error.code || null,
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    code: error.code || null,
  });
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

// Manual PowerShell test:
// Invoke-RestMethod -Uri "http://localhost:5000/api/chat/sessions" -Method GET
// Invoke-RestMethod -Uri "http://localhost:5000/api/chat/sessions" -Method POST -ContentType "application/json" -Body '{"title":"Test Chat","model":"openrouter/auto"}'

router.get("/sessions", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return sendSupabaseError(res, error, "Gagal mengambil chat sessions");
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const title = normalizeOptionalText(req.body?.title, DEFAULT_SESSION_TITLE);
    const model = normalizeOptionalText(req.body?.model, DEFAULT_MODEL);

    const sessionPayload = { title };

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([{ ...sessionPayload, model }])
      .select()
      .single();

    if (error) {
      if (!isModelSchemaError(error)) throw error;

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("chat_sessions")
        .insert([sessionPayload])
        .select()
        .single();

      if (fallbackError) throw fallbackError;

      return res.status(201).json({
        success: true,
        data: { ...fallbackData, model: DEFAULT_MODEL },
      });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendSupabaseError(res, error, "Gagal membuat chat session");
  }
});

router.get("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const sessionId = normalizeOptionalText(req.query?.session_id, "");

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
    return sendSupabaseError(res, error, "Gagal mengambil chat messages");
  }
});

router.post("/messages", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const sessionId = normalizeOptionalText(req.body?.session_id, "");
    const role = normalizeOptionalText(req.body?.role, "");
    const content = normalizeOptionalText(req.body?.content, "");
    const model = normalizeOptionalText(req.body?.model, DEFAULT_MODEL);

    if (!sessionId || !role || !content) {
      return res.status(400).json({
        success: false,
        message: "session_id, role, dan content wajib diisi",
      });
    }

    const messagePayload = {
      session_id: sessionId,
      role,
      content,
    };

    const { data, error } = await supabase
      .from("chat_messages")
      .insert([{ ...messagePayload, model }])
      .select()
      .single();

    if (error) {
      if (!isModelSchemaError(error)) throw error;

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("chat_messages")
        .insert([messagePayload])
        .select()
        .single();

      if (fallbackError) throw fallbackError;

      return res.status(201).json({
        success: true,
        data: { ...fallbackData, model: DEFAULT_MODEL },
      });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendSupabaseError(res, error, "Gagal menyimpan chat message");
  }
});

module.exports = router;
