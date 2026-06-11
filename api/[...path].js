const app = require("../server/index.js");

module.exports = function handler(req, res) {
  if (!String(req.url || "").startsWith("/api")) {
    req.url = `/api${String(req.url || "").startsWith("/") ? "" : "/"}${
      req.url || ""
    }`;
  }

  return app(req, res);
};
