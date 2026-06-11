const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const supabaseDatabase = require("../lib/supabase");

const router = express.Router();

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const OPENROUTER_TIMEOUT_MS = 30000;
const CHAT_MEMORY_LIMIT = 20;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const INVALID_SUPABASE_TOKEN_MESSAGE =
  "Supabase auth token tidak valid atau sudah expired. Silakan login ulang.";
const ORBIT_SYSTEM_PROMPT =
  "Anda adalah BLACK FLASH ORBIT AI, asisten untuk AI Workspace, monitoring, security center, laporan, dan operasi dashboard. Jawab jelas, profesional, gunakan konteks percakapan aktif sebelumnya jika tersedia, dan boleh mengingat serta menjawab kode uji harmless yang diberikan user seperti ORBIT SATU, 111, atau frasa tes lain. Jangan menolak hanya karena ada kata kode, rahasia, atau nomor jika konteksnya jelas sebagai percakapan biasa. Tetap jangan meminta, membocorkan, menebak, atau memproses API key, password, token, private key, credential, cookie, seed phrase, atau rahasia autentikasi asli. Jika user mengirim kredensial asli, arahkan untuk mencabut/rotate credential tersebut.";

let supabaseAuthClient = null;
let supabaseAuthClientKey = "";

function getSafeOpenRouterApiKey() {
  return String(process.env.OPENROUTER_API_KEY || "").trim();
}

function createHttpError(
  message,
  statusCode = 500,
  code = "SERVER_ERROR",
  details = {},
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function getSupabaseAuthConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(
      "Supabase environment belum lengkap untuk autentikasi AI.",
      500,
      "SUPABASE_ENV_MISSING",
    );
  }

  assertMatchingSupabaseProject({ supabaseAnonKey, supabaseUrl });

  return { supabaseAnonKey, supabaseUrl };
}

function assertMatchingSupabaseProject({ supabaseAnonKey, supabaseUrl }) {
  const urlProjectRef = getSupabaseProjectRefFromUrl(supabaseUrl);
  const keyProjectRef = getSupabaseProjectRefFromJwt(supabaseAnonKey);

  if (urlProjectRef && keyProjectRef && urlProjectRef !== keyProjectRef) {
    throw createHttpError(
      "Supabase URL dan anon key backend berasal dari project berbeda.",
      500,
      "SUPABASE_PROJECT_MISMATCH",
    );
  }
}

function getSupabaseProjectRefFromUrl(supabaseUrl) {
  const match = String(supabaseUrl || "").match(
    /^https:\/\/([^.]+)\.supabase\.co/i,
  );

  return match?.[1] || null;
}

function getSupabaseProjectRefFromJwt(token) {
  const [, payload] = String(token || "").split(".");

  if (!payload) return null;

  try {
    return (
      JSON.parse(
        Buffer.from(
          payload.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8"),
      )?.ref || null
    );
  } catch {
    return null;
  }
}

function getJwtPayload(token) {
  const [, payload] = String(token || "").split(".");

  if (!payload) return null;

  try {
    return JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    );
  } catch {
    return null;
  }
}

function createDevelopmentUserFromToken(token) {
  const payload = getJwtPayload(token);

  return {
    id: payload?.sub || "development-auth-bypass-user",
    aud: payload?.aud || "authenticated",
    email: payload?.email || null,
    role: payload?.role || "authenticated",
  };
}

function getSupabaseAuthClient() {
  const { supabaseAnonKey, supabaseUrl } = getSupabaseAuthConfig();
  const nextClientKey = `${supabaseUrl}:${supabaseAnonKey.slice(0, 12)}`;

  if (!supabaseAuthClient || supabaseAuthClientKey !== nextClientKey) {
    supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    supabaseAuthClientKey = nextClientKey;
  }

  return supabaseAuthClient;
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization) {
    logAuthDebug(req, "missing_authorization");
    throw createHttpError(
      "missing_authorization",
      401,
      "missing_authorization",
    );
  }

  if (!authorization.startsWith("Bearer ")) {
    logAuthDebug(req, "invalid_bearer_format");
    throw createHttpError(
      "invalid_bearer_format",
      401,
      "invalid_bearer_format",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    logAuthDebug(req, "invalid_bearer_format");
    throw createHttpError(
      "invalid_bearer_format",
      401,
      "invalid_bearer_format",
    );
  }

  return token;
}

function getAuthDebug(req) {
  const authorization = req.headers.authorization || "";
  const authHeaderStartsWithBearer = authorization.startsWith("Bearer ");
  const token = authHeaderStartsWithBearer
    ? authorization.slice("Bearer ".length).trim()
    : "";

  return {
    hasAuthorization: Boolean(authorization),
    authHeaderStartsWithBearer,
    tokenLength: token.length,
  };
}

function logAuthDebug(req, reason, details = {}) {
  console.warn("[AI Auth]", {
    ...getAuthDebug(req),
    supabaseAuthError: null,
    userId: null,
    ...details,
    reason,
  });
}

async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req);
  const supabase = getSupabaseAuthClient();

  let authResult = null;

  try {
    authResult = await supabase.auth.getUser(token);
  } catch (error) {
    if (!IS_PRODUCTION) {
      const developmentUser = createDevelopmentUserFromToken(token);

      logAuthDebug(req, "development_supabase_auth_bypass", {
        supabaseAuthError: {
          message: error.message || null,
          status: error.status || null,
        },
        userId: developmentUser.id,
      });

      return developmentUser;
    }

    logAuthDebug(req, "supabase_auth_unavailable", {
      supabaseAuthError: {
        message: error.message || null,
        status: error.status || null,
      },
    });
    throw createHttpError(
      "Gagal validasi Supabase auth token.",
      502,
      "supabase_auth_unavailable",
      {
        supabaseAuthError: {
          message: error.message || null,
          status: error.status || null,
        },
      },
    );
  }

  const user = authResult?.data?.user;
  const error = authResult?.error;
  const supabaseAuthError = error
    ? {
        message: error.message || null,
        status: error.status || null,
      }
    : null;

  logAuthDebug(
    req,
    error || !user?.id ? "invalid_supabase_token" : "supabase_auth_validated",
    {
      supabaseAuthError,
      userId: user?.id || null,
    },
  );

  if (error || !user?.id) {
    if (!IS_PRODUCTION) {
      const developmentUser = createDevelopmentUserFromToken(token);

      logAuthDebug(req, "development_supabase_auth_bypass", {
        supabaseAuthError,
        userId: developmentUser.id,
      });

      return developmentUser;
    }

    throw createHttpError(
      error?.message || INVALID_SUPABASE_TOKEN_MESSAGE,
      401,
      "invalid_supabase_token",
      {
        supabaseAuthError,
      },
    );
  }

  return user;
}

function hasInvalidHeaderCharacters(value) {
  return /[^\x20-\x7E]/.test(value);
}

function getOpenRouterError(data) {
  return data?.error || data?.provider_error || data?.providerError || null;
}

function getOpenRouterErrorMessage(data) {
  const providerError = getOpenRouterError(data);

  return (
    providerError?.message ||
    providerError?.metadata?.raw ||
    data?.message ||
    "OpenRouter gagal memproses request."
  );
}

function normalizeSessionId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSystemPrompt(value) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, 12000);
}

function normalizeChatHistoryRow(row) {
  const role = String(row?.role || "").trim();
  const content = String(row?.content || "").trim();

  if (!["user", "assistant"].includes(role) || !content) {
    return null;
  }

  return { role, content };
}

function removeCurrentMessageFromHistory(history, currentMessage) {
  const normalizedCurrentMessage = String(currentMessage || "").trim();

  if (!normalizedCurrentMessage || history.length === 0) {
    return history;
  }

  const nextHistory = [...history];
  const lastMessage = nextHistory[nextHistory.length - 1];

  if (
    lastMessage?.role === "user" &&
    String(lastMessage.content || "").trim() === normalizedCurrentMessage
  ) {
    nextHistory.pop();
  }

  return nextHistory;
}

async function getConversationHistory({ currentMessage, sessionId, userEmail }) {
  const ownerEmail = normalizeEmail(userEmail);

  if (!sessionId || !ownerEmail || !supabaseDatabase) {
    return [];
  }

  const { data, error } = await supabaseDatabase
    .from("orbit_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .eq("user_email", ownerEmail)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(CHAT_MEMORY_LIMIT);

  if (error) {
    console.warn("[AI Memory] gagal mengambil chat history", {
      code: error.code || null,
      message: error.message || null,
      sessionId,
    });
    return [];
  }

  const history = (data || [])
    .slice()
    .reverse()
    .map(normalizeChatHistoryRow)
    .filter(Boolean);

  return removeCurrentMessageFromHistory(history, currentMessage);
}

async function buildOpenRouterMessages({
  currentMessage,
  sessionId,
  systemPrompt,
  userEmail,
}) {
  const history = await getConversationHistory({
    currentMessage,
    sessionId,
    userEmail,
  });
  const activeSystemPrompt = normalizeSystemPrompt(systemPrompt);
  const systemMessages = [];

  if (activeSystemPrompt) {
    systemMessages.push({
      role: "system",
      content: activeSystemPrompt,
    });
  }

  systemMessages.push({
    role: "system",
    content: ORBIT_SYSTEM_PROMPT,
  });

  return [
    ...systemMessages,
    ...history,
    {
      role: "user",
      content: currentMessage,
    },
  ];
}

router.post("/chat", async (req, res) => {
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  const model =
    typeof req.body?.model === "string" && req.body.model.trim()
      ? req.body.model.trim()
      : DEFAULT_OPENROUTER_MODEL;
  const sessionId = normalizeSessionId(
    req.body?.sessionId || req.body?.session_id,
  );
  const systemPrompt = normalizeSystemPrompt(
    req.body?.systemPrompt || req.body?.system_prompt,
  );

  let timeout = null;

  try {
    const authenticatedUser = await requireAuthenticatedUser(req);

    const apiKey = getSafeOpenRouterApiKey();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        status: 500,
        code: "openrouter_config_missing",
        message: "OPENROUTER_API_KEY belum dikonfigurasi di file .env.",
      });
    }

    if (hasInvalidHeaderCharacters(apiKey)) {
      return res.status(500).json({
        success: false,
        status: 500,
        code: "openrouter_config_invalid",
        message:
          "OPENROUTER_API_KEY tidak valid. Pastikan tidak ada spasi, newline, emoji, huruf non-ASCII, atau karakter hasil copy-paste yang rusak.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        status: 400,
        code: "empty_message",
        message: "Message tidak boleh kosong.",
      });
    }

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    const openRouterMessages = await buildOpenRouterMessages({
      currentMessage: message,
      sessionId,
      systemPrompt,
      userEmail: authenticatedUser.email,
    });

    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:4173",
        "X-Title": "BLACK FLASH ORBIT",
      },
      body: JSON.stringify({
        model,
        messages: openRouterMessages,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const providerError = getOpenRouterError(data);
      const errorMessage = getOpenRouterErrorMessage(data);

      console.error("[OpenRouter API Error]", {
        status: response.status,
        model,
        message: errorMessage,
        providerError,
      });

      return res.status(response.status).json({
        success: false,
        status: response.status,
        code: "openrouter_error",
        message: errorMessage,
        providerError,
      });
    }

    const aiResponse = data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return res.status(502).json({
        success: false,
        status: 502,
        code: "openrouter_empty_response",
        message: "OpenRouter tidak mengembalikan jawaban AI.",
        providerError: getOpenRouterError(data),
      });
    }

    return res.status(200).json({
      success: true,
      response: aiResponse,
      model,
    });
  } catch (error) {
    if (error.statusCode || error.status) {
      return res.status(error.statusCode || error.status).json({
        success: false,
        status: error.statusCode || error.status,
        message: error.message || "Request tidak valid.",
        code: error.code || null,
        supabaseAuthError: error.supabaseAuthError || null,
      });
    }

    const isAbort = error.name === "AbortError";

    console.error("[OpenRouter Fetch Error]", {
      model,
      name: error.name,
      message: error.message,
      cause: error.cause?.message || null,
      code: error.cause?.code || null,
    });

    return res.status(isAbort ? 504 : 502).json({
      success: false,
      status: isAbort ? 504 : 502,
      message: isAbort
        ? "Request ke OpenRouter timeout."
        : `Gagal terhubung ke OpenRouter: ${error.message}`,
      cause: error.cause?.message || null,
      code: error.cause?.code || null,
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
});

module.exports = router;
