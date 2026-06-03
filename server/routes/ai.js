const express = require("express");

const router = express.Router();

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const OPENROUTER_TIMEOUT_MS = 30000;

function getSafeOpenRouterApiKey() {
  return String(process.env.OPENROUTER_API_KEY || "").trim();
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

router.post("/chat", async (req, res) => {
  const apiKey = getSafeOpenRouterApiKey();

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "OPENROUTER_API_KEY belum dikonfigurasi di file .env.",
    });
  }

  if (hasInvalidHeaderCharacters(apiKey)) {
    return res.status(500).json({
      success: false,
      status: 500,
      message:
        "OPENROUTER_API_KEY tidak valid. Pastikan tidak ada spasi, newline, emoji, huruf non-ASCII, atau karakter hasil copy-paste yang rusak.",
    });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  const model =
    typeof req.body?.model === "string" && req.body.model.trim()
      ? req.body.model.trim()
      : DEFAULT_OPENROUTER_MODEL;

  if (!message) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Message tidak boleh kosong.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
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
        messages: [
          {
            role: "system",
            content:
              "Anda adalah BLACK FLASH ORBIT AI, asisten untuk AI Workspace, monitoring, security center, laporan, dan operasi dashboard. Jawab jelas, profesional, dan jangan mengarang jika informasi tidak tersedia.",
          },
          {
            role: "user",
            content: message,
          },
        ],
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
        message: errorMessage,
        providerError,
      });
    }

    const aiResponse = data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return res.status(502).json({
        success: false,
        status: 502,
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
    clearTimeout(timeout);
  }
});

module.exports = router;
