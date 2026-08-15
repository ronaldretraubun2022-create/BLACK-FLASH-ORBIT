const { generateCompletion, AI_USE_CASES } = require("./ai/aiRouter");
const {
  getLegacyNewsroomModels,
  isValidOpenRouterModel,
  normalizeModelId,
} = require("./ai/modelRegistry");

const NEWSROOM_SYSTEM_PROMPT =
  "Anda adalah agen AI newsroom profesional. Tulis dengan nada profesional, jelas, dan gunakan bahasa Indonesia. Jangan membuat klaim fakta tanpa peringatan verifikasi. Jangan menyertakan tahun, kuartal, triwulan, atau jadwal rinci kecuali diminta oleh pengguna. Gunakan referensi sumber generik jika sumber spesifik tidak tersedia.";

function normalizeOpenRouterModel(rawModel) {
  return normalizeModelId(rawModel);
}

function getOpenRouterModels() {
  return getLegacyNewsroomModels();
}

async function generateWithOpenRouter(prompt, options = {}) {
  const result = await generateCompletion({
    maxTokens: options.maxTokens || 1500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model: options.model,
    requestId: options.requestId,
    systemPrompt: NEWSROOM_SYSTEM_PROMPT,
    temperature: options.temperature ?? 0.2,
    timeout: options.timeout || 45000,
    useCase: AI_USE_CASES.NEWSROOM,
  });

  return result.content;
}

module.exports = {
  generateWithOpenRouter,
  getOpenRouterModels,
  isValidOpenRouterModel,
  normalizeOpenRouterModel,
};
