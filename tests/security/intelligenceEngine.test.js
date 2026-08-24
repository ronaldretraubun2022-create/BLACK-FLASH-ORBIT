const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  rootDir,
  "supabase/migrations/20260824030000_orbit_intelligence_engine_v1_2.sql",
);
const routePath = path.join(rootDir, "server/routes/intelligence.js");
const repositoryPath = path.join(
  rootDir,
  "server/services/intelligence/intelligenceRepository.js",
);
const pagePath = path.join(rootDir, "apps/web/src/pages/Intelligence.jsx");
const apiPath = path.join(rootDir, "apps/web/src/services/api.js");
const intakeHelperPath = path.join(
  rootDir,
  "apps/web/src/services/intelligenceIntake.mjs",
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("intelligence migration creates owner-scoped RLS tables", () => {
  const sql = read(migrationPath);

  for (const table of [
    "orbit_intelligence_sources",
    "orbit_intelligence_entities",
    "orbit_intelligence_claims",
    "orbit_intelligence_relationships",
    "orbit_intelligence_source_links",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /claim_status text not null default 'unverified'/);
  assert.match(sql, /num_nonnulls\(entity_id, claim_id, relationship_id\) = 1/);
  assert.match(sql, /evidence_text text not null/);
  assert.match(sql, /source_url ~\* '\^https\?:\/\//);
});

test("intelligence extractor defaults claims to unverified with source evidence", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "Bupati Merauke mengatakan Program Orbit akan berjalan pada 24 Agustus 2026. PT Papua Media menyatakan platform ORBIT memiliki dashboard baru.",
      createdAt: "2026-08-24T01:00:00.000Z",
      sourceId: "manual-1",
      sourceType: "manual_note",
      title: "Rapat Orbit",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(extracted.entities.length > 0);
  assert(extracted.claims.length > 0);
  assert(extracted.claims.every((claim) => claim.status === "unverified"));
  assert(extracted.claims.every((claim) => claim.claimText));
  assert(extracted.sourceReferences.length > 0);
  assert(extracted.relationships.every((relationship) => relationship.evidenceText));
  assert(!extracted.claims.some((claim) => claim.status === "confirmed"));
});

test("intelligence extractor parses Indonesian dates without fabricating partial dates", () => {
  const {
    extractDates,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const dates = extractDates([
    "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    "Rapat lanjutan direncanakan pada 20 Agustus.",
    "Evaluasi berlangsung Agustus 2026.",
  ]);
  const fullDate = dates.find((date) => date.dateText === "20 Agustus 2026");
  const dayMonth = dates.find((date) => date.dateText === "20 Agustus");
  const monthYear = dates.find((date) => date.dateText === "Agustus 2026");

  assert.strictEqual(fullDate.isoDate, "2026-08-20");
  assert.strictEqual(fullDate.precision, "day");
  assert.strictEqual(dayMonth.isoDate, null);
  assert.strictEqual(dayMonth.precision, "month_day");
  assert.strictEqual(monthYear.isoDate, null);
  assert.strictEqual(monthYear.precision, "month_year");
});

test("Indonesian month names are temporal tokens, not persisted entities", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      sourceId: "manual-month",
      sourceType: "manual_note",
      title: "Month entity regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);

  assert(
    !extracted.entities.some(
      (entity) =>
        entity.normalizedName === "agustus" &&
        ["organization", "person", "project", "location", "product"].includes(
          entity.entityType,
        ),
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "project alpha" &&
        entity.entityType === "project",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "orbit" &&
        entity.entityType === "organization",
    ),
  );
  assert(
    extracted.entities.some(
      (entity) =>
        entity.normalizedName === "merauke" &&
        entity.entityType === "location",
    ),
  );
});

test("Indonesian declarative project start sentence creates unverified dated claim", () => {
  const {
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      sourceId: "manual-claim",
      sourceType: "manual_note",
      title: "Claim regression",
    },
    "user-1",
  );
  const extracted = extractIntelligence(source);
  const claim = extracted.claims.find((item) =>
    item.normalizedClaim.includes("project alpha dimulai"),
  );

  assert(claim);
  assert.strictEqual(claim.status, "unverified");
  assert.strictEqual(claim.observedAt, "2026-08-20T00:00:00.000Z");
  assert(
    claim.dateMentions.some(
      (date) => date.dateText === "20 Agustus 2026" && date.isoDate === "2026-08-20",
    ),
  );
});

test("controlled notes keep recurring entities and contradictory start claims comparable", () => {
  const {
    buildConflictKey,
    extractIntelligence,
    normalizeSourceInput,
  } = require("../../server/services/intelligence/intelligenceExtractor");
  const notes = [
    "ORBIT Intelligence Test melaporkan Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
    "Project Alpha disebut kembali dalam catatan operasional ORBIT pada 22 Agustus 2026 di Merauke.",
    "Sumber lain menyatakan Project Alpha belum dimulai pada 20 Agustus 2026.",
  ].map((content, index) =>
    extractIntelligence(
      normalizeSourceInput(
        {
          content,
          sourceId: `controlled-${index + 1}`,
          sourceType: "manual_note",
          title: `Controlled ${index + 1}`,
        },
        "user-1",
      ),
    ),
  );
  const entities = notes.flatMap((note) => note.entities);
  const claims = notes.flatMap((note) => note.claims);
  const dates = notes.flatMap((note) => note.dates);
  const positiveKey = buildConflictKey(notes[0].claims[0].claimText);
  const negativeKey = buildConflictKey(notes[2].claims[0].claimText);

  assert.strictEqual(
    entities.filter((entity) => entity.normalizedName === "project alpha").length,
    3,
  );
  assert.strictEqual(
    entities.filter((entity) => entity.normalizedName === "merauke").length,
    2,
  );
  assert(dates.some((date) => date.isoDate === "2026-08-20"));
  assert(dates.some((date) => date.isoDate === "2026-08-22"));
  assert(claims.length >= 2);
  assert(claims.every((claim) => claim.status === "unverified"));
  assert(!claims.some((claim) => claim.status === "confirmed"));
  assert.strictEqual(notes[0].claims[0].polarity, "positive");
  assert.strictEqual(notes[1].claims[0].observedAt, "2026-08-22T00:00:00.000Z");
  assert.strictEqual(notes[2].claims[0].polarity, "negative");
  assert.strictEqual(positiveKey, negativeKey);
});

test("intelligence normalization redacts secrets and rejects unsafe source URLs", () => {
  const { normalizeSafeSourceUrl, normalizeSourceInput } =
    require("../../server/services/intelligence/intelligenceExtractor");
  const source = normalizeSourceInput(
    {
      content:
        "Authorization: Bearer secret-token-value OPENROUTER_API_KEY=secret-key PT Papua Media mengatakan sistem aktif.",
      sourceId: "manual-secret",
      sourceType: "manual_note",
      sourceUrl: "file:///etc/passwd",
      title: "Secret check",
    },
    "user-1",
  );

  assert(!source.content.includes("secret-token-value"));
  assert(!source.content.includes("secret-key"));
  assert.strictEqual(source.sourceUrl, null);
  assert.strictEqual(normalizeSafeSourceUrl("https://example.test/source"), "https://example.test/source");
});

test("intelligence claim conflict keys represent positive and negative claim conflict", () => {
  const { buildConflictKey } = require("../../server/services/intelligence/intelligenceExtractor");
  const positive = buildConflictKey("ORBIT adalah sistem intelligence aktif.");
  const negative = buildConflictKey("ORBIT bukan sistem intelligence aktif.");

  assert.strictEqual(positive, negative);
});

test("source evidence grouping deduplicates cards while preserving target links", () => {
  const { groupSourceLinksForPresentation } = require("../../server/services/intelligence/intelligenceRepository");
  const grouped = groupSourceLinksForPresentation([
    {
      claimId: null,
      confidence: 0.62,
      entityId: "entity-1",
      evidenceText: "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      id: "link-1",
      linkType: "entity_mention",
      relationshipId: null,
      source: { id: "source-1", title: "Controlled 1" },
      sourceId: "source-1",
      targetKey: "entity:entity-1",
    },
    {
      claimId: "claim-1",
      confidence: 0.58,
      entityId: null,
      evidenceText: "Project Alpha dimulai pada 20 Agustus 2026 di Merauke.",
      id: "link-2",
      linkType: "claim_evidence",
      relationshipId: null,
      source: { id: "source-1", title: "Controlled 1" },
      sourceId: "source-1",
      targetKey: "claim:claim-1",
    },
  ]);

  assert.strictEqual(grouped.length, 1);
  assert.deepStrictEqual(grouped[0].entityIds, ["entity-1"]);
  assert.deepStrictEqual(grouped[0].claimIds, ["claim-1"]);
  assert.deepStrictEqual(grouped[0].linkTypes.sort(), [
    "claim_evidence",
    "entity_mention",
  ]);
});

test("intelligence routes require auth and expose scoped endpoints", () => {
  const source = read(routePath);

  assert.match(source, /router\.use\(requireAuth\)/);
  for (const endpoint of [
    "/overview",
    "/entities",
    "/claims",
    "/timeline",
    "/search",
    "/source-links",
    "/process",
  ]) {
    assert(source.includes(endpoint), `${endpoint} route missing`);
  }
});

test("intelligence repository scopes persistence and search by owner", () => {
  const source = read(repositoryPath);

  assert.match(source, /\.eq\("owner_id", ownerId\)/);
  assert.match(source, /owner_id: ownerId/);
  assert.match(source, /onConflict: "owner_id,source_type,source_id"/);
  assert.match(source, /duplicate_of_source_id/);
  assert.match(source, /claim_status: "conflicting"/);
  assert.match(source, /INTELLIGENCE_SOURCE_LINK_REQUIRED/);
  assert.match(source, /const sourceLink = await upsertSourceLink/);
  assert.match(source, /sourceReferences: \[sourceLink\]/);
  assert.doesNotMatch(source, /Authorization\s*[:=]/);
  assert.doesNotMatch(source, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("intelligence API client attaches authenticated v1 requests", () => {
  const source = read(apiPath);

  for (const method of [
    "getIntelligenceOverview",
    "getIntelligenceEntities",
    "getIntelligenceClaims",
    "getIntelligenceTimeline",
    "searchIntelligence",
    "getIntelligenceSourceLinks",
    "processIntelligenceSource",
  ]) {
    assert(source.includes(method), `${method} missing`);
  }

  assert.match(source, /\/api\/v1\/intelligence\/overview/);
  assert.match(source, /headers: await getAuthenticatedHeaders\(\)/);
});

test("intelligence frontend renders untrusted content as text, not raw HTML", () => {
  const source = read(pagePath);

  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /new Function/);
  assert.doesNotMatch(source, /\beval\(/);
  assert.match(source, /\{claim\.claimText\}/);
  assert.match(source, /\{link\.evidenceText\}/);
});

test("manual note intake renders a bound textarea and explicit source type state", () => {
  const source = read(pagePath);
  const helperSource = read(intakeHelperPath);

  assert.match(helperSource, /sourceType: "manual_note"/);
  assert.match(source, /useState\(DEFAULT_MANUAL_NOTE\)/);
  assert.match(source, /htmlFor="manual-intelligence-note"/);
  assert.match(source, /id="manual-intelligence-note"/);
  assert.match(source, /aria-label="Manual note content"/);
  assert.match(source, /value=\{manualNote\.content\}/);
  assert.match(source, /sourceType: event\.target\.value/);
});

test("manual note intake enablement follows source type, trimmed content, and loading state", async () => {
  const { canSubmitManualNote } = await import(pathToFileURL(intakeHelperPath));

  assert.strictEqual(
    canSubmitManualNote({
      content: "   ",
      isProcessing: false,
      sourceType: "manual_note",
    }),
    false,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: false,
      sourceType: "manual_note",
    }),
    true,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: true,
      sourceType: "manual_note",
    }),
    false,
  );
  assert.strictEqual(
    canSubmitManualNote({
      content: "ORBIT Intelligence Test melaporkan Project Alpha.",
      isProcessing: false,
      sourceType: "newsroom_generation",
    }),
    false,
  );
});

test("manual note intake builds the authenticated process API payload shape", async () => {
  const { buildManualNotePayload } = await import(pathToFileURL(intakeHelperPath));
  const now = new Date("2026-08-24T03:00:00.000Z");
  const payload = buildManualNotePayload({
    content: "  ORBIT Intelligence Test melaporkan Project Alpha.  ",
    now,
    sourceType: "manual_note",
    title: "  Smoke note  ",
  });
  const source = read(pagePath);
  const apiSource = read(apiPath);

  assert.deepStrictEqual(payload, {
    content: "ORBIT Intelligence Test melaporkan Project Alpha.",
    createdAt: "2026-08-24T03:00:00.000Z",
    sourceId: "manual-1787540400000",
    sourceType: "manual_note",
    title: "Smoke note",
  });
  assert.match(source, /api\.processIntelligenceSource\(payload\)/);
  assert.match(apiSource, /\/api\/v1\/intelligence\/process/);
  assert.match(apiSource, /headers: await getAuthenticatedHeaders\(\)/);
  assert.match(apiSource, /body: JSON\.stringify\(payload\)/);
});

test("manual note intake renders safe error text without secrets", async () => {
  const { getSafeIntelligenceIntakeError } = await import(
    pathToFileURL(intakeHelperPath)
  );
  const message = getSafeIntelligenceIntakeError({
    message:
      "Authorization: Bearer secret-token-value SUPABASE_SERVICE_ROLE_KEY=secret stack trace",
  });

  assert(!message.includes("secret-token-value"));
  assert(!message.includes("SUPABASE_SERVICE_ROLE_KEY=secret"));
  assert.strictEqual(message, "Gagal memproses intelligence source.");

  const source = read(pagePath);
  assert.match(source, /getSafeIntelligenceIntakeError\(processError\)/);
  assert.match(source, /\{intakeMessage\}/);
});
