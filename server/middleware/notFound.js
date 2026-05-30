function notFound(req, res, next) {
  const error = new Error(`Route tidak ditemukan: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

module.exports = notFound;
