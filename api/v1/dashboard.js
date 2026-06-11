module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    success: true,
    status: "ready",
    module: "dashboard",
    data: [],
    metrics: {},
    message: "Module dashboard ready for staging.",
    timestamp: new Date().toISOString()
  }));
};
