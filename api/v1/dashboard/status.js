const {
  createDashboardResponse,
  sendJson,
} = require("../../../server/lib/orbitDashboardTelemetry");

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
