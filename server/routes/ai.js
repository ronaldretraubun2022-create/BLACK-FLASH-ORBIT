const express = require("express");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
const supabaseDatabase = require("../lib/supabase");
const { buildOrbitRuntimeContext } = require("../lib/orbitRuntimeContext");
const { handleOrbitCommand } = require("../lib/orbitCommands");

const router = express.Router();

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const MIN_OPENROUTER_API_KEY_LENGTH = 32;
const OPENROUTER_API_KEY_PREFIX = "sk-or-v1-";
const OPENROUTER_TIMEOUT_MS = 30000;
const CHAT_MEMORY_LIMIT = 20;
const MAX_AI_MESSAGE_LENGTH = 12000;
const MAX_AI_HISTORY_ITEMS = 20;
const MAX_AI_MODEL_LENGTH = 120;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const INVALID_SUPABASE_TOKEN_MESSAGE =
  "Supabase auth token tidak valid atau sudah expired. Silakan login ulang.";
const ORBIT_SYSTEM_PROMPT =
  "Anda adalah BLACK FLASH ORBIT AI, asisten untuk AI Workspace, monitoring, security center, laporan, dan operasi dashboard. Jawab jelas, profesional, gunakan konteks percakapan aktif sebelumnya jika tersedia, dan boleh mengingat serta menjawab kode uji harmless yang diberikan user seperti ORBIT SATU, 111, atau frasa tes lain. Jangan menolak hanya karena ada kata kode, rahasia, atau nomor jika konteksnya jelas sebagai percakapan biasa. Tetap jangan meminta, membocorkan, menebak, atau memproses API key, password, token, private key, credential, cookie, seed phrase, atau rahasia autentikasi asli. Jika user mengirim kredensial asli, arahkan untuk mencabut/rotate credential tersebut.";

let supabaseAuthClient = null;
let supabaseAuthClientKey = "";

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 20 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || "unknown-ai-user",
  message: {
    success: false,
    status: 429,
    code: "ai_rate_limited",
    message: "Terlalu banyak request AI. Coba lagi sebentar.",
  },
});

function getRawOpenRouterApiKey() {
  return String(process.env.OPENROUTER_API_KEY || "");
}

function stripWrappingQuotes(value) {
  const trimmedValue = String(value || "").trim();
  const firstCharacter = trimmedValue[0];
  const lastCharacter = trimmedValue[trimmedValue.length - 1];

  if (
    trimmedValue.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
}

function normalizeOpenRouterApiKey(rawApiKey) {
  const trimmedKey = String(rawApiKey || "").trim();
  const withoutBearerPrefix = trimmedKey.replace(/^Bearer\s+/i, "").trim();

  return stripWrappingQuotes(withoutBearerPrefix);
}

function getOpenRouterApiKeyDiagnostics(rawApiKey) {
  const rawKey = String(rawApiKey || "");
  const trimmedKey = rawKey.trim();
  const normalizedKey = normalizeOpenRouterApiKey(rawKey);

  return {
    keyExists: Boolean(trimmedKey),
    keyLength: normalizedKey.length,
    startsWithSkOrV1: normalizedKey.startsWith(OPENROUTER_API_KEY_PREFIX),
    hasInvalidHeaderChars: hasInvalidHeaderCharacters(normalizedKey),
    containsBearerPrefix: /^Bearer\s+/i.test(trimmedKey),
    containsQuotes: /['"]/.test(rawKey),
    containsWhitespaceOrNewline: /\s/.test(rawKey),
  };
}

function getOpenRouterApiKeyValidationIssues(diagnostics) {
  const issues = [];

  if (!diagnostics.keyExists) {
    issues.push("OPENROUTER_API_KEY belum diisi");
  }

  if (diagnostics.containsBearerPrefix) {
    issues.push("hapus prefix Bearer dari OPENROUTER_API_KEY");
  }

  if (diagnostics.containsQuotes) {
    issues.push("hapus tanda kutip dari OPENROUTER_API_KEY");
  }

  if (diagnostics.containsWhitespaceOrNewline) {
    issues.push("hapus spasi atau newline dari OPENROUTER_API_KEY");
  }

  if (
    diagnostics.keyLength > 0 &&
    diagnostics.keyLength < MIN_OPENROUTER_API_KEY_LENGTH
  ) {
    issues.push("OPENROUTER_API_KEY terlalu pendek");
  }

  if (diagnostics.keyExists && !diagnostics.startsWithSkOrV1) {
    issues.push("OPENROUTER_API_KEY harus diawali sk-or-v1-");
  }

  if (diagnostics.hasInvalidHeaderChars) {
    issues.push("OPENROUTER_API_KEY mengandung karakter header tidak valid");
  }

  return issues;
}

function logOpenRouterApiKeyDiagnostics(diagnostics) {
  console.warn("[OpenRouter Env Diagnostics]", diagnostics);
}

function validateOpenRouterApiKey() {
  const rawApiKey = getRawOpenRouterApiKey();
  const diagnostics = getOpenRouterApiKeyDiagnostics(rawApiKey);
  const apiKey = normalizeOpenRouterApiKey(rawApiKey);
  const validationIssues = getOpenRouterApiKeyValidationIssues(diagnostics);

  logOpenRouterApiKeyDiagnostics(diagnostics);

  if (!diagnostics.keyExists) {
    throw createHttpError(
      "Konfigurasi OpenRouter belum siap. OPENROUTER_API_KEY belum diisi.",
      500,
      "openrouter_config_missing",
    );
  }

  if (
    diagnostics.hasInvalidHeaderChars ||
    diagnostics.keyLength < MIN_OPENROUTER_API_KEY_LENGTH ||
    !diagnostics.startsWithSkOrV1
  ) {
    throw createHttpError(
      `Konfigurasi OpenRouter tidak valid. ${validationIssues.join("; ")}.`,
      500,
      "openrouter_config_invalid",
    );
  }

  return apiKey;
}

function getOpenRouterSiteUrl() {
  return String(process.env.OPENROUTER_SITE_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
}

function getOpenRouterAppName() {
  return String(process.env.OPENROUTER_APP_NAME || "BLACK FLASH ORBIT").trim();
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

function sendSafeError(res, error, fallbackMessage = "Request AI gagal.") {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  return res.status(safeStatus).json({
    success: false,
    status: safeStatus,
    code: error?.code || "ai_request_failed",
    message: error?.safeMessage || error?.message || fallbackMessage,
  });
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

async function requireAiAuth(req, res, next) {
  try {
    req.user = await requireAuthenticatedUser(req);
    return next();
  } catch (error) {
    return sendSafeError(res, error, "Autentikasi AI gagal.");
  }
}

async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req);
  const supabase = getSupabaseAuthClient();

  let authResult = null;

  try {
    authResult = await supabase.auth.getUser(token);
  } catch (error) {
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

function getSafeOpenRouterStatusMessage(status) {
  if (status === 401 || status === 403) {
    return "Konfigurasi akses provider AI tidak valid.";
  }

  if (status === 429) {
    return "Provider AI sedang membatasi request. Coba lagi nanti.";
  }

  if (status >= 500) {
    return "OpenRouter gagal memproses request.";
  }

  return "OpenRouter menolak request AI.";
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

function normalizeModel(value) {
  if (typeof value !== "string") return DEFAULT_OPENROUTER_MODEL;

  const model = value.trim();
  return model ? model.slice(0, MAX_AI_MODEL_LENGTH) : DEFAULT_OPENROUTER_MODEL;
}

function normalizeClientHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_AI_HISTORY_ITEMS)
    .map((message) => normalizeChatHistoryRow(message))
    .filter(Boolean);
}

function validateAiChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError("Body request tidak valid.", 400, "invalid_body");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = normalizeSessionId(body.sessionId || body.session_id);

  if (!message) {
    throw createHttpError("Message tidak boleh kosong.", 400, "empty_message");
  }

  if (message.length > MAX_AI_MESSAGE_LENGTH) {
    throw createHttpError("Message terlalu panjang.", 413, "message_too_large");
  }

  if (!sessionId) {
    throw createHttpError("sessionId wajib diisi.", 400, "session_required");
  }

  return {
    history: normalizeClientHistory(body.history),
    message,
    model: normalizeModel(body.model),
    sessionId,
    systemPrompt: normalizeSystemPrompt(
      body.systemPrompt || body.system_prompt,
    ),
  };
}

function normalizeChatHistoryRow(row) {
  const role = String(row?.role || "").trim();
  const content = String(row?.content || "").trim();

  if (!["user", "assistant"].includes(role) || !content) {
    return null;
  }

  return { role, content: content.slice(0, MAX_AI_MESSAGE_LENGTH) };
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

async function getConversationHistory({
  currentMessage,
  fallbackHistory = [],
  sessionId,
  userEmail,
}) {
  const ownerEmail = normalizeEmail(userEmail);

  if (!sessionId || !ownerEmail || !supabaseDatabase) {
    return fallbackHistory;
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
    return fallbackHistory;
  }

  const history = (data || [])
    .slice()
    .reverse()
    .map(normalizeChatHistoryRow)
    .filter(Boolean);

  return removeCurrentMessageFromHistory(history, currentMessage);
}

async function logAiAuditEvent({
  code = null,
  durationMs,
  model,
  sessionId,
  status,
  user,
}) {
  try {
    const userEmail = normalizeEmail(user?.email);
    const userId = user?.id || null;
    const message = `AI chat ${status}: user=${userEmail || userId || "unknown"} session=${sessionId} model=${model} duration=${durationMs}ms`;

    console.info("[AI Audit]", {
      code,
      durationMs,
      model,
      sessionId,
      status,
      userEmail: userEmail || null,
      userId,
    });

    if (!supabaseDatabase) return;

    const { error } = await supabaseDatabase.from("orbit_activity").insert([
      {
        type: "ai_chat",
        message,
        time: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("[AI Audit] gagal menyimpan audit log", {
        code: error.code || null,
        message: error.message || null,
      });
    }
  } catch (auditError) {
    console.warn("[AI Audit] gagal menulis audit log", {
      message: auditError.message || null,
    });
  }
}

async function buildOpenRouterMessages({
  currentMessage,
  fallbackHistory,
  sessionId,
  systemPrompt,
  userEmail,
}) {
  const history = await getConversationHistory({
    currentMessage,
    fallbackHistory,
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

  systemMessages.push({
    role: "system",
    content: buildOrbitRuntimeContext(),
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

router.post("/chat", requireAiAuth, aiChatLimiter, async (req, res) => {
  const startedAt = Date.now();
  let requestContext = {
    message: "",
    model: DEFAULT_OPENROUTER_MODEL,
    sessionId: "",
    systemPrompt: "",
    history: [],
  };
  let timeout = null;

  try {
    const authenticatedUser = req.user;
    requestContext = validateAiChatBody(req.body);
    const { history, message, model, sessionId, systemPrompt } = requestContext;

    const orbitCommandResponse = handleOrbitCommand(message);

    if (orbitCommandResponse) {
      await logAiAuditEvent({
        durationMs: Date.now() - startedAt,
        model: "orbit-command",
        sessionId,
        status: "success",
        user: authenticatedUser,
      });

      return res.status(200).json({
        success: true,
        response: orbitCommandResponse,
        model: "orbit-command",
      });
    }

    const apiKey = validateOpenRouterApiKey();

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    const openRouterMessages = await buildOpenRouterMessages({
      currentMessage: message,
      fallbackHistory: history,
      sessionId,
      systemPrompt,
      userEmail: authenticatedUser.email,
    });

    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getOpenRouterSiteUrl(),
        "X-Title": getOpenRouterAppName(),
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
      const safeProviderMessage = getSafeOpenRouterStatusMessage(
        response.status,
      );

      console.error("[OpenRouter API Error]", {
        status: response.status,
        model,
        message: errorMessage,
        providerError,
      });

      throw createHttpError(
        safeProviderMessage,
        response.status,
        "openrouter_error",
      );
    }

    const aiResponse = data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw createHttpError(
        "OpenRouter tidak mengembalikan jawaban AI.",
        502,
        "openrouter_empty_response",
      );
    }

    await logAiAuditEvent({
      durationMs: Date.now() - startedAt,
      model,
      sessionId,
      status: "success",
      user: authenticatedUser,
    });

    return res.status(200).json({
      success: true,
      response: aiResponse,
      model,
    });
  } catch (error) {
    const isAbort = error.name === "AbortError";

    const status = error.statusCode || error.status || (isAbort ? 504 : 502);
    const code =
      error.code || (isAbort ? "openrouter_timeout" : "ai_fetch_failed");
    const message = isAbort
      ? "Request ke OpenRouter timeout."
      : error.statusCode || error.status
        ? error.message
        : "Gagal terhubung ke OpenRouter.";

    console.error("[AI Route Error]", {
      code,
      status,
      model: requestContext.model,
      name: error.name,
      message: error.message,
      sessionId: requestContext.sessionId,
    });

    await logAiAuditEvent({
      code,
      durationMs: Date.now() - startedAt,
      model: requestContext.model,
      sessionId: requestContext.sessionId,
      status: "failed",
      user: req.user,
    });

    return sendSafeError(
      res,
      createHttpError(message, status, code),
      "Request AI gagal.",
    );
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
});

module.exports = router;
