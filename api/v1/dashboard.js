const {
  createDashboardResponse,
  sendJson,
  withTelemetryAuth,
} = require("../../server/lib/orbitDashboardTelemetry");

function handler(req, res) {
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
}

module.exports = withTelemetryAuth(handler);
