function errorHandler(error, req, res, next) {
  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const message =
    statusCode === 404
      ? "Route tidak ditemukan."
      : statusCode >= 500
        ? "Terjadi kesalahan server."
        : getSafeClientMessage(statusCode);

  if (process.env.NODE_ENV !== "production") {
    console.error("[ORBIT Error Handler]", {
      message: error?.message || "Unhandled server error",
      method: req.method,
      path: req.originalUrl,
      stack: error?.stack || null,
      statusCode,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

function getSafeClientMessage(statusCode) {
  if (statusCode === 400) return "Request tidak valid.";
  if (statusCode === 401) return "Autentikasi diperlukan.";
  if (statusCode === 403) return "Akses ditolak.";
  if (statusCode === 413) return "Payload terlalu besar.";
  if (statusCode === 429) return "Terlalu banyak request. Coba lagi nanti.";

  return "Request gagal diproses.";
}

module.exports = errorHandler;
