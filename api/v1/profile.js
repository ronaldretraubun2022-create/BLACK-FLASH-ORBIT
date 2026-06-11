module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  res.end(JSON.stringify({
    success: true,
    status: "ready",
    module: "profile",
    data: {
      name: "BLACK FLASH ORBIT Operator",
      role: "operator",
      workspace: "BLACK FLASH ORBIT",
      environment: "production"
    },
    metrics: {},
    message: "Profile endpoint ready.",
    timestamp: new Date().toISOString()
  }));
};
