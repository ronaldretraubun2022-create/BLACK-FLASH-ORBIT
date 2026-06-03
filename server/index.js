require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes");
const aiRoutes = require("./routes/ai");
const backupRoutes = require("./routes/backup");
const chatRoutes = require("./routes/chat.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function requireRouteHandler(routeName, handler) {
  if (typeof handler !== "function") {
    throw new TypeError(`${routeName} harus export Express router/function.`);
  }

  return handler;
}

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  cors({
    origin: NODE_ENV === "production" ? CORS_ORIGIN : true,
    credentials: true,
  }),
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "BLACK FLASH ORBIT",
    version: "1.0.0",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Terlalu banyak request. Coba lagi nanti.",
    },
  }),
);

if (NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BLACK FLASH ORBIT API aktif.",
    version: "1.0.0",
  });
});

app.use("/api/v1", requireRouteHandler("routes/index.js", apiRoutes));
app.use("/api/ai", requireRouteHandler("routes/ai.js", aiRoutes));
app.use("/api/backup", requireRouteHandler("routes/backup.js", backupRoutes));
app.use("/api/chat", requireRouteHandler("routes/chat.routes.js", chatRoutes));

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BLACK FLASH ORBIT server berjalan di http://localhost:${PORT}`);
});
