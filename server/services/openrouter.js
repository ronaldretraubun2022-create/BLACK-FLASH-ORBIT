const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat-v3";
const MODEL_FALLBACKS = [];
const OPENROUTER_TIMEOUT_MS = 45000;
const DEBUG_OPENROUTER = process.env.DEBUG_OPENROUTER === "true";

function logOpenRouterDebug(message, metadata) {
  if (DEBUG_OPENROUTER) {
    console.info(message, metadata);
  }
}

function logOpenRouterWarning(message, metadata) {
  if (DEBUG_OPENROUTER) {
    console.warn(message, metadata);
  }
}

function logOpenRouterError(error) {
  if (DEBUG_OPENROUTER) {
    console.error("[OpenRouter] error", {
      name: error?.name || "Error",
    });
  }
}

function normalizeOpenRouterApiKey(rawApiKey) {
  if (typeof rawApiKey !== "string") return "";

  const trimmed = rawApiKey.trim();
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, "").trim();
  return withoutBearer.replace(/^['"]|['"]$/g, "").trim();
}

function normalizeOpenRouterModel(rawModel) {
  if (typeof rawModel !== "string") return "";
  const model = rawModel.trim();
  if (!model || /^(null|undefined)$/i.test(model)) return "";
  return model;
}

function isValidOpenRouterModel(model) {
  const normalizedModel = normalizeOpenRouterModel(model);
  if (!normalizedModel) return false;
  if (/:(?:free)\b/i.test(normalizedModel)) return false;
  return true;
}

function getOpenRouterModels() {
  const configured = normalizeOpenRouterModel(process.env.OPENROUTER_MODEL);

  if (!isValidOpenRouterModel(configured)) {
    return [DEFAULT_OPENROUTER_MODEL];
  }

  const models = [configured];

  if (!models.includes(DEFAULT_OPENROUTER_MODEL)) {
    models.unshift(DEFAULT_OPENROUTER_MODEL);
  }

  return models;
}

function extractContentFromOpenRouter(data) {
  if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
    return null;
  }

  const firstChoice = data.choices[0];
  const contentFromMessage = firstChoice?.message?.content;
  if (typeof contentFromMessage === "string" && contentFromMessage.trim()) {
    return contentFromMessage.trim();
  }

  const textContent = firstChoice?.text;
  if (typeof textContent === "string" && textContent.trim()) {
    return textContent.trim();
  }

  return null;
}

async function generateWithOpenRouter(prompt) {
  const apiKey = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY belum dikonfigurasi pada backend.");
  }

  const models = getOpenRouterModels();
  let lastError = null;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    try {
      logOpenRouterDebug("[OpenRouter] trying model", { model });

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Anda adalah agen AI newsroom profesional. Tulis dengan nada profesional, jelas, dan gunakan bahasa Indonesia. Jangan membuat klaim fakta tanpa peringatan verifikasi. Jangan menyertakan tahun, kuartal, triwulan, atau jadwal rinci kecuali diminta oleh pengguna. Gunakan referensi sumber generik jika sumber spesifik tidak tersedia.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      const safeStatusText = response.statusText || "Unknown";
      const choicesLength = Array.isArray(data?.choices)
        ? data.choices.length
        : 0;

      logOpenRouterDebug("[OpenRouter] response metadata", {
        choicesLength,
        model,
        status: response.status,
        statusText: safeStatusText,
      });

      if (!response.ok) {
        lastError = new Error(
          `OpenRouter request failed with status ${response.status}`,
        );
        logOpenRouterWarning(
          "[OpenRouter] model failed, trying next fallback if available",
          { model, status: response.status },
        );
        continue;
      }

      const content = extractContentFromOpenRouter(data);

      if (typeof content !== "string" || !content.trim()) {
        const errorMsg =
          `OpenRouter response tidak valid atau kosong. ` +
          `status=${response.status} ${safeStatusText}. ` +
          `choicesLength=${choicesLength}`;
        lastError = new Error(errorMsg);
        logOpenRouterWarning(
          "[OpenRouter] model returned invalid content, trying next fallback if available",
          { model, status: response.status },
        );
        continue;
      }

      return content;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Permintaan ke OpenRouter timeout. Silakan coba lagi.");
      }

      logOpenRouterError(error);
      lastError = new Error(
        "Gagal menghubungi OpenRouter. Silakan periksa konfigurasi backend dan coba lagi.",
      );
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw (
    lastError || new Error("OpenRouter tidak memberikan respons yang valid.")
  );
}

module.exports = {
  generateWithOpenRouter,
  normalizeOpenRouterModel,
  getOpenRouterModels,
  isValidOpenRouterModel,
};
