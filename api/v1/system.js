const { getOrbitSystem, sendJson } = require("../../server/lib/orbitDashboardTelemetry");

module.exports = function handler(req, res) {
  sendJson(res, getOrbitSystem());
};
