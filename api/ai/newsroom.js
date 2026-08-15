const app = require("../../server/index.js");

module.exports = function handler(req, res) {
  const url = new URL(req.url || "/", "http://orbit.local");
  const nestedPath = url.searchParams.get("__orbit_path");

  if (nestedPath) {
    url.searchParams.delete("__orbit_path");

    const queryString = url.searchParams.toString();

    req.url =
      `/api/ai/newsroom/${nestedPath}` +
      (queryString ? `?${queryString}` : "");
  }

  return app(req, res);
};
