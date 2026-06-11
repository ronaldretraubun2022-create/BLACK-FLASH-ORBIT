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

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const vercelUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CORS_ORIGIN,
  process.env.OPENROUTER_SITE_URL,
  vercelUrl,
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

function requireRouteHandler(routeName, handler) {
  if (typeof handler !== "function") {
    throw new TypeError(`${routeName} harus export Express router/function.`);
  }

  return handler;
}

function healthPayload() {
  return {
    success: true,
    status: "online",
    service: "BLACK FLASH ORBIT API",
    version: "1.0.0",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  }),
);

app.use(compression());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, "");

      if (!isProduction) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);

if (NODE_ENV !== "test") {
  app.use(morgan(isProduction ? "combined" : "dev"));
}

app.get(
  ["/", "/api", "/health", "/healthz", "/api/health", "/api/healthz"],
  (req, res) => {
    res.status(200).json(healthPayload());
  },
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    [
      "/",
      "/api",
      "/health",
      "/healthz",
      "/api/health",
      "/api/healthz",
      "/api/v1/health",
      "/api/v1/system",
    ].includes(req.path),
  message: {
    success: false,
    message: "Terlalu banyak request. Coba lagi nanti.",
  },
});

app.use(apiLimiter);

app.use(
  "/api/v1/audit",
  requireRouteHandler("routes/audit.routes.js", auditRoutes),
);

app.use("/api/v1", requireRouteHandler("routes/index.js", apiRoutes));
app.use("/api/ai", requireRouteHandler("routes/ai.js", aiRoutes));
app.use("/api/backup", requireRouteHandler("routes/backup.js", backupRoutes));
app.use("/api/chat", requireRouteHandler("routes/chat.routes.js", chatRoutes));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `BLACK FLASH ORBIT server berjalan di http://localhost:${PORT}`,
    );
  });
}

module.exports = app;
