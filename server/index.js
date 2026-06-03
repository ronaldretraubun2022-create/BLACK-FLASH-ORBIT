require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes");
const aiRoutes = require("./routes/ai");
const chatRoutes = require("./routes/chat.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

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

app.use("/api/v1", apiRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BLACK FLASH ORBIT server berjalan di http://localhost:${PORT}`);
});
