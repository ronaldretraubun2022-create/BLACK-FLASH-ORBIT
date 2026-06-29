const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { buildNewsroomPrompt } = require("../services/promptBuilder");
const { generateWithOpenRouter } = require("../services/openrouter");

const router = express.Router();
const MAX_TOPIC_LENGTH = 3000;
const FACT_CLASSIFICATIONS = new Set([
  "FACT",
  "OFFICIAL_CLAIM",
  "USER_INPUT",
  "OBSERVATION",
  "INFERENCE",
  "ASSUMPTION",
  "UNVERIFIED",
  "CONFLICTING",
]);
const DEFAULT_RECOMMENDED_SOURCES = [
  "Pemerintah Provinsi",
  "BPS",
  "Kemendagri",
  "Dokumen Resmi OPD",
];
const OFFICIAL_SOURCE_KEYWORDS = [
  "bappenas",
  "bappeda",
  "bawaslu",
  "bps",
  "dinas",
  "diskominfo",
  "dprd",
  "kementerian",
  "kemendagri",
  "kemenkeu",
  "kemenpan",
  "kpu",
  "pemda",
  "pemerintah",
  "pemkab",
  "pemkot",
  "pemprov",
  "polri",
];
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

function normalizeStatement(value) {
  return sanitizeText(value).replace(/\s+/g, " ");
}

function includesAnyKeyword(value, keywords) {
  const text = String(value || "").toLowerCase();

  return keywords.some((keyword) => text.includes(keyword));
}

function hasNumberLikeClaim(statement) {
  return /(?:\b\d+(?:[.,]\d+)?\b|rp\s*\d+|%|persen|miliar|juta|ribu|triliun)/i.test(
    statement,
  );
}

function hasOfficialSource(statement, context = {}) {
  const sourceHints = [
    statement,
    context.source,
    ...(Array.isArray(context.sources) ? context.sources : []),
  ].join(" ");

  return includesAnyKeyword(sourceHints, OFFICIAL_SOURCE_KEYWORDS);
}

function getRecommendedSources(statement, classification) {
  const sources = [];
  const text = String(statement || "").toLowerCase();

  if (/kemendagri|pemda|pemprov|pemerintah|dinas|diskominfo/.test(text)) {
    sources.push("Kemendagri", "Pemerintah Provinsi", "Diskominfo");
  }

  if (/bps|statistik|penduduk|kemiskinan|inflasi|ekonomi|tenaga kerja/.test(text)) {
    sources.push("BPS", "Laporan Statistik Resmi");
  }

  if (/anggaran|rp\s*\d+|miliar|juta|triliun|dana/.test(text)) {
    sources.push("Kemenkeu", "APBD", "Dokumen Resmi OPD");
  }

  if (/pemilu|pilkada|suara|kpu|bawaslu/.test(text)) {
    sources.push("KPU", "Bawaslu");
  }

  if (classification === "OBSERVATION") {
    sources.push("Catatan Lapangan", "Dokumentasi Foto/Video");
  }

  if (sources.length === 0) {
    sources.push(...DEFAULT_RECOMMENDED_SOURCES);
  }

  return [...new Set(sources)].slice(0, 5);
}

function createFactClassification({
  classification,
  confidence,
  reason,
  statement,
  verificationNeeded,
}) {
  const safeClassification = FACT_CLASSIFICATIONS.has(classification)
    ? classification
    : "UNVERIFIED";

  return {
    statement,
    classification: safeClassification,
    confidence: clampScore(confidence),
    reason,
    verification_needed: Boolean(verificationNeeded),
    recommended_sources: getRecommendedSources(statement, safeClassification),
  };
}

function isUserProvidedStatement(statement, context = {}) {
  const cleanStatement = normalizeStatement(statement).toLowerCase();
  const cleanTopic = normalizeStatement(context.topic).toLowerCase();

  if (!cleanStatement || !cleanTopic) return false;

  return cleanStatement === cleanTopic || cleanTopic.includes(cleanStatement);
}

function classifyNewsroomFact(statement, context = {}) {
  const cleanStatement = normalizeStatement(statement);

  if (!cleanStatement) {
    return createFactClassification({
      classification: "UNVERIFIED",
      confidence: 0,
      reason: "Pernyataan kosong dan tidak dapat diverifikasi.",
      statement: "",
      verificationNeeded: true,
    });
  }

  const lowerStatement = cleanStatement.toLowerCase();
  const officialSource = hasOfficialSource(cleanStatement, context);
  const numberLikeClaim = hasNumberLikeClaim(cleanStatement);

  if (
    context.conflicting === true ||
    includesAnyKeyword(lowerStatement, [
      "bertentangan",
      "berbeda dengan",
      "konflik",
      "tidak sesuai",
    ])
  ) {
    return createFactClassification({
      classification: "CONFLICTING",
      confidence: 55,
      reason: "Pernyataan mengandung sinyal konflik atau perbedaan data.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (context.verified === true || context.sourceType === "verified") {
    return createFactClassification({
      classification: "FACT",
      confidence: 90,
      reason: "Pernyataan ditandai sebagai fakta terverifikasi dalam konteks.",
      statement: cleanStatement,
      verificationNeeded: false,
    });
  }

  if (
    officialSource &&
    includesAnyKeyword(lowerStatement, [
      "berdasarkan",
      "dilaporkan",
      "diumumkan",
      "mengklaim",
      "menurut",
      "menyampaikan",
      "menyatakan",
      "rilis",
    ])
  ) {
    return createFactClassification({
      classification: "OFFICIAL_CLAIM",
      confidence: 75,
      reason:
        "Pernyataan merujuk lembaga resmi, tetapi tetap perlu konfirmasi dokumen/sumber utama.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (numberLikeClaim && !officialSource) {
    return createFactClassification({
      classification: "UNVERIFIED",
      confidence: 45,
      reason: "Pernyataan memuat angka tanpa sumber resmi yang jelas.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "diasumsikan",
      "diperkirakan",
      "diprediksi",
      "kemungkinan",
      "potensi dampak",
      "berpotensi",
      "akan berdampak",
      "akan meningkatkan",
    ])
  ) {
    return createFactClassification({
      classification: "ASSUMPTION",
      confidence: 50,
      reason: "Pernyataan bersifat prediktif atau berbasis asumsi.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "dapat disimpulkan",
      "mengindikasikan",
      "merekomendasikan",
      "perlu",
      "rekomendasi",
      "sebaiknya",
      "strategi",
    ])
  ) {
    return createFactClassification({
      classification: "INFERENCE",
      confidence: 65,
      reason: "Pernyataan adalah rekomendasi atau kesimpulan analitis.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (
    includesAnyKeyword(lowerStatement, [
      "catatan lapangan",
      "diamati",
      "ditemukan",
      "observasi",
      "terlihat",
      "terpantau",
    ])
  ) {
    return createFactClassification({
      classification: "OBSERVATION",
      confidence: 70,
      reason: "Pernyataan berasal dari pengamatan atau catatan lapangan.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  if (context.userInput === true || isUserProvidedStatement(cleanStatement, context)) {
    return createFactClassification({
      classification: "USER_INPUT",
      confidence: 80,
      reason: "Pernyataan berasal dari input pengguna dan belum berdiri sebagai fakta terverifikasi.",
      statement: cleanStatement,
      verificationNeeded: true,
    });
  }

  return createFactClassification({
    classification: "UNVERIFIED",
    confidence: 40,
    reason: "Pernyataan belum memiliki sumber atau status verifikasi yang jelas.",
    statement: cleanStatement,
    verificationNeeded: true,
  });
}

function splitFactStatements(value) {
  return String(value || "")
    .split(/(?:[.!?]\s+|\n+|;\s+)/)
    .map(normalizeStatement)
    .filter(Boolean)
    .slice(0, 12);
}

function classifyNewsroomFacts(statements, context = {}) {
  return statements.map((statement) =>
    classifyNewsroomFact(statement, {
      ...context,
      topic: context.topic,
    }),
  );
}

function formatFactClassificationTable(items) {
  const rows = items.map((item) =>
    [
      escapeMarkdownCell(item.statement),
      item.classification,
      `${item.confidence}%`,
      item.verification_needed ? "Required" : "Not required",
      item.recommended_sources.join(", "),
    ].join(" | "),
  );

  return [
    "## Fact Classification Table",
    "| Statement | Type | Confidence | Verification | Sources |",
    "|---|---|---:|---|---|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function escapeMarkdownCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
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

    const factClassifications = classifyNewsroomFacts(
      splitFactStatements(trimmedTopic),
      {
        topic: trimmedTopic,
        userInput: true,
      },
    );
    const factClassificationTable =
      formatFactClassificationTable(factClassifications);
    const prompt = buildNewsroomPrompt({
      ...promptPayload,
      factClassificationTable,
    });
    const draft = await generateWithOpenRouter(prompt);
    const userProvidedTemporalInfo = hasTemporalReference(trimmedTopic);
    const normalizedDraft = normalizeNewsroomDraft(
      String(draft || "").trim(),
      userProvidedTemporalInfo,
    );
    const draftWithFactClassification = [
      factClassificationTable,
      normalizedDraft,
    ]
      .filter(Boolean)
      .join("\n\n");

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
      draft: draftWithFactClassification,
      factClassifications,
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
        promptVersion: "2.5.0",
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
module.exports.classifyNewsroomFact = classifyNewsroomFact;
module.exports.classifyNewsroomFacts = classifyNewsroomFacts;
module.exports.formatFactClassificationTable = formatFactClassificationTable;
