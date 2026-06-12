const { createDashboardResponse, sendJson } = require("../dashboard.js");

module.exports = function handler(req, res) {
  sendJson(res, createDashboardResponse());
};
