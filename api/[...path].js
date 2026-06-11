const app = require("../server/index.js");

function normalizeRequestUrl(req) {
  const rawUrl = String(req.url || "");

  if (rawUrl.startsWith("/api/[...path]") && req.query?.path) {
    const url = new URL(rawUrl, "http://localhost");
    const pathValue = Array.isArray(req.query.path)
      ? req.query.path.join("/")
      : String(req.query.path);

    url.searchParams.delete("path");

    const cleanPath = pathValue.replace(/^\/+/, "");
    const search = url.searchParams.toString();
    req.url = `/api/${cleanPath}${search ? `?${search}` : ""}`;
    return;
  }

  if (!rawUrl.startsWith("/api")) {
    req.url = `/api${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }
}

module.exports = function handler(req, res) {
  if (!String(req.url || "").startsWith("/api")) {
    req.url = `/api${String(req.url || "").startsWith("/") ? "" : "/"}${
      req.url || ""
    }`;
  }

  return app(req, res);
};
