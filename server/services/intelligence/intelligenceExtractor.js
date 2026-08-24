const crypto = require("node:crypto");

const ENTITY_TYPES = new Set([
  "person",
  "organization",
  "location",
  "project",
  "product",
  "event",
]);
const CLAIM_STATUSES = new Set([
  "confirmed",
  "supported",
  "conflicting",
  "unverified",
  "inferred",
]);
const SOURCE_TYPES = new Set([
  "knowledge_document",
  "newsroom_generation",
  "workflow_run",
  "automation_record",
  "manual_note",
]);
const MONTH_PATTERN =
  "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December";
const SENSITIVE_TEXT_PATTERN =
  /(authorization\s*[:=]\s*bearer\s+[a-z0-9._~+/=-]+|bearer\s+[a-z0-9._~+/=-]+|[a-z0-9_.-]*(api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|password|passwd|secret)[a-z0-9_.-]*\s*[:=]\s*['"]?[^'",;\s)}\]]+)/gi;
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);
const NEGATION_PATTERN = /\b(tidak|bukan|belum|denied|not|never|no)\b/i;

function createHttpError(message, statusCode = 500, code = "INTELLIGENCE_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeText(value, maxLength = 20000) {
  return String(value || "")
    .replace(SENSITIVE_TEXT_PATTERN, "[REDACTED]")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeKeyword(value, maxLength = 120) {
  return sanitizeText(value, maxLength)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return sanitizeText(value, 180) || "Untitled Intelligence Source";
}

function normalizeSourceType(value) {
  const sourceType = normalizeKeyword(value, 80).replace(/[\s-]+/g, "_");

  if (!SOURCE_TYPES.has(sourceType)) {
    throw createHttpError(
      "Source type intelligence tidak valid.",
      400,
      "INTELLIGENCE_INVALID_SOURCE_TYPE",
    );
  }

  return sourceType;
}

function normalizeEntityType(value) {
  const entityType = normalizeKeyword(value, 40).replace(/-/g, "_");

  return ENTITY_TYPES.has(entityType) ? entityType : "organization";
}

function normalizeClaimStatus(value, fallback = "unverified") {
  const status = normalizeKeyword(value, 40).replace(/[\s-]+/g, "_");

  return CLAIM_STATUSES.has(status) ? status : fallback;
}

function normalizeIsoDate(value) {
  if (!value) return new Date().toISOString();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();

  return date.toISOString();
}

function normalizeSafeSourceUrl(value) {
  const raw = sanitizeText(value, 500);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!SAFE_URL_PROTOCOLS.has(url.protocol)) return null;
    if (!url.hostname || url.username || url.password) return null;

    return url.href.slice(0, 500);
  } catch {
    return null;
  }
}

function normalizeSourceInput(input = {}, ownerId) {
  const sourceType = normalizeSourceType(input.sourceType || input.source_type);
  const sourceId = sanitizeText(input.sourceId || input.source_id, 160);
  const content = sanitizeText(input.content, 120000);

  if (!ownerId) {
    throw createHttpError("Owner intelligence wajib tersedia.", 401, "INTELLIGENCE_OWNER_REQUIRED");
  }

  if (!sourceId) {
    throw createHttpError("Source id intelligence wajib tersedia.", 400, "INTELLIGENCE_SOURCE_ID_REQUIRED");
  }

  if (!content) {
    throw createHttpError("Content intelligence wajib tersedia.", 400, "INTELLIGENCE_CONTENT_REQUIRED");
  }

  return {
    content,
    contentHash: hashText(content),
    createdAt: normalizeIsoDate(input.createdAt || input.created_at),
    ownerId,
    sourceId,
    sourceType,
    sourceUrl: normalizeSafeSourceUrl(input.sourceUrl || input.source_url),
    title: normalizeTitle(input.title),
  };
}

function hashText(value) {
  return crypto
    .createHash("sha256")
    .update(sanitizeText(value, 120000).toLowerCase())
    .digest("hex");
}

function splitSentences(content) {
  return sanitizeText(content, 120000)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sanitizeText(sentence, 800))
    .filter((sentence) => sentence.length >= 24)
    .slice(0, 80);
}

function inferEntityType(name, sentence = "") {
  const cleanName = sanitizeText(name, 120);
  const cleanSentence = sentence.toLowerCase();

  if (/\b(pt|cv|dinas|kementerian|komisi|universitas|pemda|polres|polda|badan|bank|media|redaksi)\b/i.test(cleanName)) {
    return "organization";
  }

  if (/\b(proyek|project|program|inisiatif|rencana)\b/i.test(cleanName)) {
    return "project";
  }

  if (/\b(aplikasi|platform|produk|sistem|dashboard|engine)\b/i.test(cleanName)) {
    return "product";
  }

  if (/\b(rapat|konferensi|sidang|peluncuran|festival|event|kejadian|insiden)\b/i.test(cleanSentence)) {
    return "event";
  }

  if (/\b(kabupaten|provinsi|kota|distrik|kampung|jalan|papua|merauke|jayapura|asmat|mappi|boven digoel)\b/i.test(cleanName)) {
    return "location";
  }

  const words = cleanName.split(/\s+/);
  if (words.length >= 2 && words.length <= 4) return "person";

  return "organization";
}

function extractNamedEntities(sentences) {
  const entities = new Map();
  const capitalizedPhrasePattern =
    /\b([A-Z][\p{L}\p{N}.&'-]*(?:\s+(?:[A-Z][\p{L}\p{N}.&'-]*|di|dan|of|for|the)){0,5})\b/gu;

  sentences.forEach((sentence) => {
    for (const match of sentence.matchAll(capitalizedPhrasePattern)) {
      const name = sanitizeText(match[1], 120);
      const normalizedName = normalizeKeyword(name, 120);

      if (!normalizedName || normalizedName.length < 3) continue;
      if (/^(dan|atau|the|a|an|ini|itu)$/i.test(name)) continue;
      if (/^\d+$/.test(normalizedName)) continue;

      const entityType = inferEntityType(name, sentence);
      const key = `${entityType}:${normalizedName}`;
      const existing = entities.get(key);

      if (existing) {
        existing.mentions += 1;
        existing.evidence.push(sentence);
        existing.confidence = Math.min(0.92, existing.confidence + 0.03);
      } else {
        entities.set(key, {
          confidence: 0.62,
          entityType,
          evidence: [sentence],
          mentions: 1,
          name,
          normalizedName,
        });
      }
    }
  });

  return Array.from(entities.values()).slice(0, 60);
}

function extractDates(sentences) {
  const datePattern = new RegExp(
    `\\b(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTH_PATTERN})\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4})\\b`,
    "gi",
  );
  const dates = [];

  sentences.forEach((sentence) => {
    for (const match of sentence.matchAll(datePattern)) {
      dates.push({
        dateText: sanitizeText(match[1], 80),
        evidence: sentence,
      });
    }
  });

  return dates.slice(0, 40);
}

function extractTopics(content, title) {
  const stopWords = new Set([
    "yang",
    "dan",
    "atau",
    "untuk",
    "dengan",
    "pada",
    "dari",
    "dalam",
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
  ]);
  const frequency = new Map();

  normalizeKeyword(`${title} ${content}`, 30000)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
    .forEach((word) => frequency.set(word, (frequency.get(word) || 0) + 1));

  return Array.from(frequency.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 12)
    .map(([topic]) => topic);
}

function buildConflictKey(text) {
  return normalizeKeyword(text, 500)
    .replace(/\b(tidak|bukan|belum|denied|not|never|no|adalah|merupakan|is|are|was)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractClaims(sentences, source) {
  const claimPattern =
    /\b(adalah|merupakan|mengatakan|menyatakan|melaporkan|mencatat|menunjukkan|akan|telah|sudah|memiliki|berada|menargetkan|mengklaim|confirmed|reported|said|will|has|is|are|was)\b/i;

  return sentences
    .filter((sentence) => claimPattern.test(sentence))
    .slice(0, 80)
    .map((sentence) => {
      const normalizedClaim = normalizeKeyword(sentence, 500);
      const polarity = NEGATION_PATTERN.test(sentence) ? "negative" : "positive";

      return {
        claimText: sentence,
        confidence: 0.58,
        conflictKey: buildConflictKey(sentence),
        extractedAt: new Date().toISOString(),
        normalizedClaim,
        observedAt: source.createdAt,
        polarity,
        status: "unverified",
      };
    });
}

function extractRelationships(entities, claims) {
  const relationships = [];

  claims.forEach((claim) => {
    const related = entities.filter((entity) =>
      claim.normalizedClaim.includes(entity.normalizedName),
    );

    for (let index = 0; index < related.length - 1; index += 1) {
      const subject = related[index];
      const object = related[index + 1];

      if (!subject || !object || subject.normalizedName === object.normalizedName) {
        continue;
      }

      relationships.push({
        confidence: Math.min(subject.confidence, object.confidence, claim.confidence),
        evidenceText: claim.claimText,
        objectKey: `${object.entityType}:${object.normalizedName}`,
        relationshipType: "co_mentioned",
        sourceClaimText: claim.claimText,
        status: "supported",
        subjectKey: `${subject.entityType}:${subject.normalizedName}`,
      });
    }
  });

  const unique = new Map();
  relationships.forEach((relationship) => {
    const key = [
      relationship.subjectKey,
      relationship.relationshipType,
      relationship.objectKey,
      normalizeKeyword(relationship.evidenceText, 160),
    ].join("|");

    if (!unique.has(key)) unique.set(key, relationship);
  });

  return Array.from(unique.values()).slice(0, 80);
}

function extractIntelligence(source) {
  const sentences = splitSentences(source.content);
  const entities = extractNamedEntities(sentences);
  const claims = extractClaims(sentences, source);
  const dates = extractDates(sentences);
  const topics = extractTopics(source.content, source.title);
  const relationships = extractRelationships(entities, claims);

  return {
    claims,
    dates,
    entities,
    relationships,
    sourceReferences: [
      {
        locator: source.sourceUrl || `${source.sourceType}:${source.sourceId}`,
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        title: source.title,
      },
    ],
    topics,
  };
}

function getEntityKey(entity) {
  return `${normalizeEntityType(entity.entityType)}:${normalizeKeyword(entity.normalizedName || entity.name, 120)}`;
}

module.exports = {
  CLAIM_STATUSES,
  ENTITY_TYPES,
  SOURCE_TYPES,
  buildConflictKey,
  createHttpError,
  extractIntelligence,
  getEntityKey,
  hashText,
  normalizeClaimStatus,
  normalizeEntityType,
  normalizeKeyword,
  normalizeSafeSourceUrl,
  normalizeSourceInput,
  normalizeSourceType,
  sanitizeText,
};
