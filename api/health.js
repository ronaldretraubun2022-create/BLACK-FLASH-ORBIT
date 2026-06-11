module.exports = function handler(req, res) {
  res.status(200).json({
    success: true,
    status: "online",
    service: "BLACK FLASH ORBIT API",
  });
};
