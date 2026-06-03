const DEFAULT_TIMEOUT_MS = 30000;

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
        [errorBody?.message, providerMessage].filter(Boolean).join(" | ") ||
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
};
