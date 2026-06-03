const DEFAULT_TIMEOUT_MS = 30000;

function requireAccessToken(accessToken) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("Access token login tidak tersedia. Silakan login ulang.");
  }

  return accessToken.trim();
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const providerMessage =
        errorBody?.providerError?.message ||
        errorBody?.providerError?.metadata?.raw;
      const message =
        [errorBody?.message, errorBody?.error, providerMessage]
          .filter(Boolean)
          .join(" | ") ||
        `API request failed with status ${response.status}.`;

      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("API request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  getHealth() {
    return request("/api/health");
  },
  sendAiChat({ message, model }) {
    return request("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, model }),
    });
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
