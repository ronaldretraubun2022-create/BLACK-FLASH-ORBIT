const assert = require("assert");
const {
  normalizeNewsroomDraft,
  hasTemporalReference,
} = require("../server/routes/newsroom.js");
const {
  normalizeOpenRouterModel,
  getOpenRouterModels,
  isValidOpenRouterModel,
} = require("../server/services/openrouter.js");

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

runTest(
  "normalizeNewsroomDraft blocks Q1/Q2/Q3/Q4 when no topic time info",
  () => {
    const draft = "Rencana dimulai pada Q1 dan Q2 dengan laporan kuartal.";
    const normalized = normalizeNewsroomDraft(draft, false);
    assert(!/\bQ[1-4]\b/.test(normalized), "Q1/Q2/Q3/Q4 should be removed");
    assert(!/\bkuartal\b/i.test(normalized), "kuartal should be removed");
    assert(!/\btriwulan\b/i.test(normalized), "triwulan should be removed");
    assert(
      !/\b2025\b/.test(normalized),
      "year 2025 should be removed where topic has no time info",
    );
    assert(
      /Catatan: Rincian waktu/.test(normalized),
      "should append timeline validation note",
    );
  },
);

runTest(
  "normalizeNewsroomDraft keeps year/quarter if topic includes time info",
  () => {
    const draft = "Target akan dicapai pada Q3 2025.";
    const normalized = normalizeNewsroomDraft(draft, true);
    assert(
      /\bQ3\b/.test(normalized),
      "Q3 should be kept when user topic includes time info",
    );
    assert(
      /\b2025\b/.test(normalized),
      "year should be kept when user topic includes time info",
    );
    assert(
      !/Catatan: Rincian waktu/.test(normalized),
      "should not append validation note when time info is provided",
    );
  },
);

runTest(
  "normalizeNewsroomDraft rewrites specific citations to generic forms",
  () => {
    const draft = `Analisis didasarkan pada RKPD 2025 Papua Selatan dan RPJMD 2024 Papua Selatan.
  Sumber lain: Diskominfo Papua Selatan, BPS Papua Selatan.`;
    const normalized = normalizeNewsroomDraft(draft, false);
    assert(
      /Dokumen RPJMD\/RKPD/.test(normalized),
      "RKPD/RPJMD citations should normalize to Dokumen RPJMD/RKPD",
    );
    assert(
      /\bDiskominfo\b/.test(normalized),
      "Diskominfo citation should normalize to Diskominfo",
    );
    assert(/\bBPS\b/.test(normalized), "BPS citation should normalize to BPS");
  },
);

runTest(
  "normalizeNewsroomDraft blocks province suffixes and planning document titles",
  () => {
    const draft = `Sumber: Diskominfo Provinsi, Dokumen perencanaan daerah (RPJMD, Renstra OPD), RPJMD, Renstra OPD.
  Referensi tambahan: Pemerintah Provinsi Papua Selatan dan Laporan Statistik 2025.`;
    const normalized = normalizeNewsroomDraft(draft, false);

    assert(
      !/Diskominfo\s+Provinsi/i.test(normalized),
      "Diskominfo province suffix should be removed",
    );
    assert(
      !/Dokumen perencanaan daerah/i.test(normalized),
      "planning document title should be removed",
    );
    assert(
      !/\bRPJMD,\s*Renstra OPD\b/i.test(normalized),
      "RPJMD/Renstra list should be replaced",
    );
    assert(
      !/Papua\s+Selatan/i.test(normalized),
      "region suffix should be removed from citation labels",
    );
    assert(
      /Dokumen RPJMD\/RKPD/.test(normalized),
      "RPJMD/RKPD should map to the allowed generic label",
    );
    assert(
      /Dokumen Resmi OPD/.test(normalized),
      "Renstra OPD should map to the allowed generic OPD label",
    );
    assert(/\bDiskominfo\b/.test(normalized), "Diskominfo should remain");
    assert(
      /Pemerintah Provinsi/.test(normalized),
      "government province source should be generic",
    );
    assert(
      /Laporan Statistik Resmi/.test(normalized),
      "statistics source should be generic",
    );
  },
);

runTest("normalizeOpenRouterModel skips null and empty values", () => {
  assert.strictEqual(normalizeOpenRouterModel(null), "");
  assert.strictEqual(normalizeOpenRouterModel(undefined), "");
  assert.strictEqual(normalizeOpenRouterModel(""), "");
  assert.strictEqual(normalizeOpenRouterModel("null"), "");
  assert.strictEqual(normalizeOpenRouterModel("undefined"), "");
});

runTest("isValidOpenRouterModel rejects :free variants and duplicates", () => {
  assert.strictEqual(isValidOpenRouterModel("openrouter/auto"), true);
  assert.strictEqual(
    isValidOpenRouterModel("qwen/qwen3-235b-a22b:free"),
    false,
  );
  assert.strictEqual(
    isValidOpenRouterModel(" qwen/qwen3-235b-a22b:free "),
    false,
  );
});

runTest(
  "getOpenRouterModels returns safe default and removes invalid fallback",
  () => {
    const original = process.env.OPENROUTER_MODEL;
    process.env.OPENROUTER_MODEL = "null";
    try {
      const models = getOpenRouterModels();
      assert(Array.isArray(models), "models should be an array");
      assert.strictEqual(
        models[0],
        "deepseek/deepseek-chat-v3",
        "default model should be used when configured model is invalid",
      );
      assert(
        !models.some((m) => /:free\b/.test(m)),
        "no :free variant should remain in the model list",
      );
    } finally {
      process.env.OPENROUTER_MODEL = original;
    }
  },
);

if (process.exitCode === 1) {
  process.exit(1);
}
