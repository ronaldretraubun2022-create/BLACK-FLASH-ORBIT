const { getOrbitActivity, sendJson } = require("./dashboard.js");

module.exports = function handler(req, res) {
  sendJson(res, getOrbitActivity());
};
