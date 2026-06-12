cat > (api / v1 / dashboard / status.js) << "EOF";
const { createDashboardResponse, sendJson } = require("../dashboard");

module.exports = function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return sendJson(
      res,
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  return sendJson(res, createDashboardResponse());
};
EOF;
