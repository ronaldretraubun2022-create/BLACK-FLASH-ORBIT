const express = require("express");

const router = express.Router();

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const OPENROUTER_TIMEOUT_MS = 30000;

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

function logOpenRouterError({ data, message, model, status }) {
  const providerError = getOpenRouterError(data);

  console.error("[OpenRouter]", {
    model,
    status,
    message,
    providerError: providerError
      ? {
          code: providerError.code,
          message: providerError.message,
          metadata: providerError.metadata,
        }
      : null,
  });
}

router.post("/chat", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: "OPENROUTER_API_KEY belum dikonfigurasi di server.",
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
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "BLACK FLASH ORBIT",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Anda adalah asisten AI BLACK FLASH ORBIT untuk newsroom, jurnalistik Indonesia, multimedia, dan operasi dashboard. Jawab jelas, profesional, dan langsung.",
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
      const message = getOpenRouterErrorMessage(data);
      const providerError = getOpenRouterError(data);

      logOpenRouterError({
        data,
        message,
        model,
        status: response.status,
      });

      return res.status(response.status).json({
        success: false,
        status: response.status,
        message,
        providerError,
      });
    }

    const aiResponse = data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      const message = "OpenRouter tidak mengembalikan jawaban AI.";

      logOpenRouterError({
        data,
        message,
        model,
        status: 502,
      });

      return res.status(502).json({
        success: false,
        status: 502,
        message,
        providerError: getOpenRouterError(data),
      });
    }

    return res.status(200).json({
      success: true,
      response: aiResponse,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        status: 504,
        message: "Request ke OpenRouter timeout.",
      });
    }

    console.error("[OpenRouter]", {
      model,
      status: 500,
      message: error.message,
    });

    return res.status(500).json({
      success: false,
      status: 500,
      message: "Terjadi error saat menghubungi OpenRouter.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
