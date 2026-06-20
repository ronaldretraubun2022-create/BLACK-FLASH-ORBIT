const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { buildNewsroomPrompt } = require("../services/promptBuilder");
const { generateWithOpenRouter } = require("../services/openrouter");

const router = express.Router();
const MAX_TOPIC_LENGTH = 3000;
const DEBUG_NEWSROOM_AI = process.env.DEBUG_NEWSROOM_AI === "true";

function logNewsroomDebug(message, metadata) {
  if (DEBUG_NEWSROOM_AI) {
    console.info(message, metadata);
  }
}

function logNewsroomError(error) {
  if (DEBUG_NEWSROOM_AI) {
    console.error("[AI Newsroom Route] error", {
      name: error?.name || "Error",
    });
  }
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[\x00-\x1f\x7f<>]/g, " ")
    .trim();
}

function isValidString(value) {
  return typeof value === "string" && sanitizeText(value).length > 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPublicationReadiness(score) {
  if (score >= 85) return "Ready";
  if (score >= 60) return "Review Required";
  return "Verification Required";
}

function hasTemporalReference(value) {
  if (typeof value !== "string") return false;
  return /\b(?:\d{4}|Q[1-4]|kuartal|triwulan|semester|tahun)\b/i.test(value);
}

function normalizeNewsroomDraft(text, userProvidedTemporalInfo = false) {
  if (typeof text !== "string") return "";

  let normalized = String(text);
  const citationReplacements = [
    {
      pattern:
        /\bDokumen\s+perencanaan\s+daerah\s*\(\s*(?:RPJMD|RKPD)\s*,\s*Renstra\s+OPD\s*\)/gi,
      replacement: "Dokumen RPJMD/RKPD dan Dokumen Resmi OPD",
    },
    {
      pattern: /\b(?:RPJMD|RKPD)\s*,\s*Renstra\s+OPD\b/gi,
      replacement: "Dokumen RPJMD/RKPD dan Dokumen Resmi OPD",
    },
    {
      pattern: /\bRenstra\s+OPD\b/gi,
      replacement: "Dokumen Resmi OPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s+\d{4}\s+(?:Provinsi\s+)?Papua\s+Selatan\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s+(?:Provinsi\s+)?Papua\s+Selatan\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\b(?:RKPD|RPJMD)\s*\d{4}\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\bDokumen\s+(?:RPJMD|RKPD)\s*\d{4}\b/gi,
      replacement: "Dokumen RPJMD/RKPD",
    },
    {
      pattern: /\bDiskominfo\s+(?:Provinsi(?:\s+Papua\s+Selatan)?|Papua\s+Selatan)\b/gi,
      replacement: "Diskominfo",
    },
    {
      pattern: /\bBPS\s+(?:Provinsi(?:\s+Papua\s+Selatan)?|Papua\s+Selatan)\b/gi,
      replacement: "BPS",
    },
    {
      pattern: /\bPemerintah\s+Provinsi\s+Papua\s+Selatan\b/gi,
      replacement: "Pemerintah Provinsi",
    },
    {
      pattern: /\bLaporan\s+Statistik(?:\s+(?:Resmi|Daerah|Provinsi))?(?:\s+\d{4})?\b/gi,
      replacement: "Laporan Statistik Resmi",
    },
    {
      pattern: /\bSiaran Pers(?: Resmi)?\s*(?:tahun\s*\d{4})?\b/gi,
      replacement: "Pemerintah Provinsi",
    },
  ];

  citationReplacements.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, replacement);
  });

  if (!userProvidedTemporalInfo) {
    const marker = "periode indikatif memerlukan verifikasi resmi";
    normalized = normalized
      .replace(/\bQ[1-4]\b/gi, marker)
      .replace(/\bkuartal\b/gi, marker)
      .replace(/\btriwulan\b/gi, marker)
      .replace(/\b20(?:24|25|26|27)\b/g, marker)
      .replace(/\bperiode periode\b/gi, "periode");
  }

  const timelineMarkerPattern =
    /\b(?:Q[1-4]|kuartal|triwulan|tahun\s*\d{4})\b/i;

  if (!userProvidedTemporalInfo && timelineMarkerPattern.test(text)) {
    normalized +=
      "\n\nCatatan: Rincian waktu dan referensi sumber harus divalidasi lebih lanjut. Hindari menyertakan detail periode atau dokumen khusus kecuali telah diberikan secara eksplisit oleh pengguna.";
  }

  return normalized.trim();
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      topic,
      layer,
      mode,
      audience,
      complexity,
      factGuard = true,
      citationEngine = true,
      sourceConfidence = true,
      assessment,
      priority,
    } = req.body || {};

    logNewsroomDebug("[AI Newsroom Route] request received", {
      layer,
      mode,
      audience,
      complexity,
      factGuard,
      citationEngine,
      sourceConfidence,
    });

    if (!isValidString(topic)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Topic harus berupa teks dan tidak boleh kosong.",
      });
    }

    const trimmedTopic = String(topic).trim();

    if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: `Topic terlalu panjang. Panjang maksimum adalah ${MAX_TOPIC_LENGTH} karakter.`,
      });
    }

    if (!isValidString(layer)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Layer harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(mode)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Mode harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(audience)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Audience harus berupa teks dan tidak boleh kosong.",
      });
    }

    if (!isValidString(complexity)) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: "Complexity harus berupa teks dan tidak boleh kosong.",
      });
    }

    const verifiedFactsCount = Number(req.body.verifiedFactsCount) || 0;
    const verificationItemsCount = Number(req.body.verificationItemsCount) || 0;
    const assessmentData =
      assessment && typeof assessment === "object" ? assessment : {};

    const promptPayload = {
      topic: sanitizeText(trimmedTopic),
      layer: sanitizeText(layer),
      mode: sanitizeText(mode),
      audience: sanitizeText(audience),
      complexity: sanitizeText(complexity),
      factGuard: factGuard !== false,
      citationEngine: citationEngine !== false,
      sourceConfidence: sourceConfidence !== false,
    };

    const prompt = buildNewsroomPrompt(promptPayload);
    const draft = await generateWithOpenRouter(prompt);
    const userProvidedTemporalInfo = hasTemporalReference(trimmedTopic);
    const normalizedDraft = normalizeNewsroomDraft(
      String(draft || "").trim(),
      userProvidedTemporalInfo,
    );

    logNewsroomDebug("[AI Newsroom Route] draft generated", {
      draftLength: normalizedDraft.length,
    });

    const baseScore =
      (Number(assessmentData.strategicValue) || 0) +
      (Number(assessmentData.decisionSupport) || 0) +
      (Number(assessmentData.publicImpact) || 0) +
      (Number(assessmentData.readiness) || 0);
    const confidenceScore = clampScore(baseScore / 4);
    const verificationPenalty = verificationItemsCount * 5;
    const verificationBonus = verifiedFactsCount * 3;
    const finalConfidenceScore = clampScore(
      confidenceScore + verificationBonus - verificationPenalty,
    );
    const publicationReadiness = getPublicationReadiness(finalConfidenceScore);

    return res.status(200).json({
      success: true,
      draft: normalizedDraft,
      confidence: {
        score: finalConfidenceScore,
        publicationReadiness,
      },
      metadata: {
        ...promptPayload,
        assessment: assessment || null,
        priority: priority || null,
        verifiedFactsCount,
        verificationItemsCount,
        promptVersion: "2.4.3",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logNewsroomError(error);

    return res.status(500).json({
      success: false,
      error: "ai_newsroom_failed",
      message: "Gagal menghasilkan draf AI Newsroom. Silakan coba lagi nanti.",
    });
  }
});

module.exports = router;
module.exports.normalizeNewsroomDraft = normalizeNewsroomDraft;
module.exports.hasTemporalReference = hasTemporalReference;
