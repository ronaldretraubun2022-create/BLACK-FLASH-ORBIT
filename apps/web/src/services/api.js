import { supabase } from "../lib/supabase";
import { normalizePromptCategory } from "../data/promptCategories";

const DEFAULT_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_WINDOW_MS = 60000;
const API_BASE_URL =
  String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "") ||
  "/api";

const AUTH_FAILURE_CODES = new Set([
  "missing_authorization",
  "invalid_bearer_format",
  "invalid_supabase_token",
  "invalid_supabase_user",
]);

function requireAccessToken(accessToken) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return accessToken.trim();
}

async function getSupabaseAccessToken() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  let session = await getSessionFromSupabaseAuth();

  if (shouldRefreshSession(session)) {
    await refreshSupabaseSession();
    session = await getSessionFromSupabaseAuth();
  }

  logFrontendAuthDebug(session);

  return requireAccessToken(session?.access_token);
}

export async function getAuthenticatedHeaders() {
  const accessToken = await getSupabaseAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getSessionFromSupabaseAuth() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  if (!data.session?.user?.id || !data.session?.access_token) {
    logFrontendAuthDebug(data.session);
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return data.session;
}

function shouldRefreshSession(session) {
  const expiresAtMs = Number(session?.expires_at || 0) * 1000;

  if (!expiresAtMs) return true;

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_WINDOW_MS;
}

async function refreshSupabaseSession() {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    throw error;
  }

  return data.session ?? null;
}

function logFrontendAuthDebug(session) {
  const accessToken = session?.access_token || "";

  console.info("[AI Auth Frontend]", {
    hasSession: Boolean(session),
    hasAccessToken: Boolean(accessToken),
    userId: session?.user?.id || null,
    tokenLength: accessToken.length,
  });
}

function getApiErrorMessage(errorBody, status) {
  const candidates = [
    errorBody?.message,
    errorBody?.error,
    errorBody?.providerError?.message,
    errorBody?.providerError?.metadata?.raw,
  ]
    .filter(Boolean)
    .map((value) => formatErrorValue(value))
    .filter(Boolean);

  const uniqueMessages = [...new Set(candidates)];

  return uniqueMessages[0] || `API request failed with status ${status}.`;
}

function formatErrorValue(value) {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message || value.name;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Terjadi error pada API.";
    }
  }

  return String(value || "").trim();
}

function isAuthFailureResponse(errorBody, status) {
  const code = String(errorBody?.code || "").toLowerCase();

  return status === 401 && AUTH_FAILURE_CODES.has(code);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(resolveApiUrl(path), {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const data = await parseJsonResponse(response);

    if (!response.ok && response.status !== 304) {
      const message = getApiErrorMessage(data, response.status);

      throw new ApiRequestError(message, {
        body: data,
        status: response.status,
      });
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("API request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse(response) {
  if (response.status === 204 || response.status === 304) {
    return {
      data: [],
      success: true,
    };
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (response.ok) {
      return {
        data: [],
        success: true,
      };
    }

    const preview = text.replace(/\s+/g, " ").trim().slice(0, 120);
    const message = preview
      ? `Endpoint API mengembalikan non-JSON (${response.status}): ${preview}`
      : `Endpoint API mengembalikan non-JSON (${response.status}).`;

    throw new ApiRequestError(message, {
      body: { message },
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch {
    if (response.ok) {
      return {
        data: [],
        success: true,
      };
    }

    const message = `Endpoint API mengembalikan JSON tidak valid (${response.status}).`;

    throw new ApiRequestError(message, {
      body: { message },
      status: response.status,
    });
  }
}

function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;

  const cleanPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${path || ""}`;

  if (cleanPath === "/api") return API_BASE_URL;
  if (cleanPath.startsWith("/api/")) {
    return `${API_BASE_URL}${cleanPath.slice(4)}`;
  }

  return `${API_BASE_URL}${cleanPath}`;
}

class ApiRequestError extends Error {
  constructor(message, { body, status }) {
    super(message);
    this.name = "ApiRequestError";
    this.body = body;
    this.status = status;
  }
}

function normalizeModuleData(response, fallback) {
  if (!response) return fallback;
  if (Array.isArray(response)) return response;
  if (response.data !== undefined) return response.data;
  return response;
}

function normalizeReports(response) {
  const data = normalizeModuleData(response, []);
  return Array.isArray(data) ? data : [];
}

function normalizeAutomation(response) {
  if (!response) return {};
  if (response.engines && typeof response.engines === "object") {
    return response.engines;
  }

  const data = normalizeModuleData(response, {});
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function normalizeSecurity(response) {
  if (!response || Array.isArray(response)) return {};
  return response;
}

export const api = {
  getHealth() {
    return request("/api/health");
  },

  async getV1Health() {
    try {
      return await request("/api/v1/health");
    } catch {
      return request("/api/health");
    }
  },

  getSystem() {
    return request("/api/v1/system");
  },

  getMetrics() {
    return request("/api/v1/metrics");
  },

  getActivity() {
    return request("/api/v1/activity");
  },

  getProjects() {
    return request("/api/v1/projects");
  },

  async getSecurity() {
    return normalizeSecurity(await request("/api/v1/security"));
  },

  getDashboardStatus() {
    return request("/api/v1/dashboard/status");
  },

  async getReports() {
    return normalizeReports(await request("/api/v1/reports"));
  },

  async getPromptCategories() {
    return request("/api/v1/prompts/categories", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getPrompts() {
    return request("/api/v1/prompts", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async createPrompt({ category, content, title }) {
    return request("/api/v1/prompts", {
      method: "POST",
      headers: await getAuthenticatedHeaders(),
      body: JSON.stringify({
        title,
        content,
        category: normalizePromptCategory(category),
      }),
    });
  },

  async getAutomation() {
    return normalizeAutomation(await request("/api/v1/automation"));
  },

  async getAutomationStatus() {
    return request("/api/v1/automation/status", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationJobs() {
    return request("/api/v1/automation/jobs", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getAutomationHistory() {
    return request("/api/v1/automation/history", {
      headers: await getAuthenticatedHeaders(),
    });
  },

  async getCommandCenter() {
    const [health, metrics, projects, security, automation, activity, system] =
      await Promise.all([
        this.getV1Health(),
        this.getMetrics(),
        this.getProjects(),
        this.getSecurity(),
        this.getAutomation(),
        this.getActivity(),
        this.getSystem(),
      ]);

    return {
      activity,
      automation,
      health,
      metrics,
      projects,
      security,
      system,
    };
  },

  async sendAiChat({ history, message, model, sessionId, systemPrompt }) {
    let accessToken = await getSupabaseAccessToken();
    const body = JSON.stringify({
      history: Array.isArray(history) ? history : [],
      message,
      model,
      sessionId,
      systemPrompt,
    });

    try {
      return await request("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
    } catch (error) {
      if (!isAuthFailureResponse(error.body, error.status)) {
        throw error;
      }

      const refreshedSession = await refreshSupabaseSession();
      const session = refreshedSession || (await getSessionFromSupabaseAuth());

      logFrontendAuthDebug(session);
      accessToken = requireAccessToken(session?.access_token);

      return request("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });
    }
  },

  renameChatSession({ accessToken, sessionId, title }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
  },

  deleteChatSession({ accessToken, sessionId }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  togglePinChatSession({ accessToken, pinned, sessionId }) {
    const token = requireAccessToken(accessToken);

    return request(`/api/chat/sessions/${sessionId}/pin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pinned }),
    });
  },
};
