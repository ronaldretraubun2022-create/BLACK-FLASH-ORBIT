const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
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
