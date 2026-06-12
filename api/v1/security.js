const { getOrbitSecurity, sendJson } = require("./dashboard.js");

module.exports = function handler(req, res) {
  sendJson(res, getOrbitSecurity());
};
