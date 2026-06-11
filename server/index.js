require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes");
const aiRoutes = require("./routes/ai");
const auditRoutes = require("./routes/audit.routes");
const backupRoutes = require("./routes/backup");
const chatRoutes = require("./routes/chat.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const isProduction = NODE_ENV === "production";

function requireRouteHandler(routeName, handler) {
  if (typeof handler !== "function") {
    throw new TypeError(`${routeName} harus export Express router/function.`);
  }

  return handler;
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    !isProduction &&
    ["/api/health", "/api/v1/health", "/api/v1/system"].includes(req.path),
  message: {
    success: false,
    message: "Terlalu banyak request. Coba lagi nanti.",
  },
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(compression());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  cors({
    origin: isProduction ? CORS_ORIGIN : true,
    credentials: true,
  }),
);

if (NODE_ENV !== "test") {
  app.use(morgan(isProduction ? "combined" : "dev"));
}

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "online",
    service: "BLACK FLASH ORBIT",
    version: "1.0.0",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(apiLimiter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BLACK FLASH ORBIT API aktif.",
    version: "1.0.0",
    environment: NODE_ENV,
  });
});

app.use(
  "/api/v1/audit",
  requireRouteHandler("routes/audit.routes.js", auditRoutes),
);
app.use("/api/v1", requireRouteHandler("routes/index.js", apiRoutes));
app.use("/api/ai", requireRouteHandler("routes/ai.js", aiRoutes));
app.use("/api/backup", requireRouteHandler("routes/backup.js", backupRoutes));
app.use("/api/chat", requireRouteHandler("routes/chat.routes.js", chatRoutes));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "BLACK FLASH ORBIT API online",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BLACK FLASH ORBIT server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
