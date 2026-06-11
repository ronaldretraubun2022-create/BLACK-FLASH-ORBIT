module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    success: true,
    status: "ready",
    module: "automation",
    data: [],
    metrics: {},
    message: "Tidak ada issue aktif dari endpoint automation.",
    timestamp: new Date().toISOString()
  }));
};
