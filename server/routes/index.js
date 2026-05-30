const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BLACK FLASH ORBIT API",
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
