const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiServicePath = path.resolve(
  __dirname,
  "../../apps/web/src/services/api.js",
);

test("frontend API service initializes URL helpers before API_BASE_URL", () => {
  const source = fs.readFileSync(apiServicePath, "utf8");
  const helperImportIndex = source.indexOf(
    'import apiUrlUtils from "./apiUrlUtils.cjs";',
  );
  const helperBindingIndex = source.indexOf("} = apiUrlUtils;");
  const apiBaseUrlIndex = source.indexOf(
    "const API_BASE_URL = normalizeApiBaseUrl(getConfiguredApiBaseUrl());",
  );

  assert(helperImportIndex >= 0, "apiUrlUtils import must exist");
  assert(helperBindingIndex > helperImportIndex, "apiUrlUtils must be bound");
  assert(
    apiBaseUrlIndex > helperBindingIndex,
    "API_BASE_URL must initialize after URL helper binding",
  );
});
