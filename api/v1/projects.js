const { getOrbitProjects, sendJson } = require("./dashboard.js");

module.exports = function handler(req, res) {
  sendJson(res, getOrbitProjects());
};
