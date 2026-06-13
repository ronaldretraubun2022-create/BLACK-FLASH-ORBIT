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
const knowledgeRoutes = require("./routes/knowledge.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const localDevelopmentOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function normalizeCorsOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

function parseCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeCorsOrigin)
    .filter((origin) => origin && origin !== "*");
}

function parseUrlOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      if (!item || item === "*") return "";

      try {
        return new URL(item).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function uniqueValues(values) {
  return values.filter(
    (value, index, source) => value && source.indexOf(value) === index,
  );
}

function isDevelopmentHostname(hostname) {
  const cleanHostname = String(hostname || "").toLowerCase();
  const parts = cleanHostname.split(".").map((part) => Number(part));

  if (cleanHostname === "localhost" || cleanHostname === "127.0.0.1") {
    return true;
  }

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isDevelopmentCorsOrigin(origin) {
  if (isProduction) return false;

  try {
    const url = new URL(origin);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      isDevelopmentHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

const configuredCorsOrigins = [
  ...parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ...(isProduction ? [] : parseCorsOrigins(process.env.CORS_ORIGIN)),
];

const allowedOrigins = [
  ...(isProduction ? [] : localDevelopmentOrigins),
  ...configuredCorsOrigins,
].filter((origin, index, origins) => origins.indexOf(origin) === index);

const localDevelopmentResourceOrigins = [
  ...localDevelopmentOrigins,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

const localDevelopmentConnectOrigins = [
  ...localDevelopmentResourceOrigins,
  "ws://localhost:5173",
  "ws://127.0.0.1:5173",
  "ws://localhost:3000",
  "ws://127.0.0.1:3000",
  `ws://localhost:${PORT}`,
  `ws://127.0.0.1:${PORT}`,
];

function getExternalConnectSources() {
  return uniqueValues([
    ...parseUrlOrigins(process.env.SUPABASE_URL),
    ...parseUrlOrigins(process.env.VITE_SUPABASE_URL),
    ...parseUrlOrigins(process.env.VITE_API_BASE_URL),
    ...parseUrlOrigins(process.env.OPENROUTER_BASE_URL),
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://openrouter.ai",
    "https://*.openrouter.ai",
  ]);
}

function getHelmetOptions() {
  const developmentResourceSources = isProduction
    ? []
    : uniqueValues(localDevelopmentResourceOrigins);
  const developmentConnectSources = isProduction
    ? []
    : uniqueValues(localDevelopmentConnectOrigins);

  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          ...developmentResourceSources,
          ...(isProduction ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", ...developmentResourceSources],
        imgSrc: ["'self'", "data:", "blob:", ...developmentResourceSources],
        connectSrc: [
          "'self'",
          ...getExternalConnectSources(),
          ...developmentConnectSources,
        ],
        fontSrc: ["'self'", "data:", ...developmentResourceSources],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: {
      policy: isProduction ? "same-origin" : "cross-origin",
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    xContentTypeOptions: true,
  };
}

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

function hasEnvValue(key) {
  return Boolean(String(process.env[key] || "").trim());
}

function getStartupEnvironmentDiagnostics() {
  const hasSupabaseUrl = hasEnvValue("SUPABASE_URL");
  const hasSupabaseAnonKey = hasEnvValue("SUPABASE_ANON_KEY");
  const hasViteSupabaseUrl = hasEnvValue("VITE_SUPABASE_URL");
  const hasViteSupabaseAnonKey = hasEnvValue("VITE_SUPABASE_ANON_KEY");

  return {
    SUPABASE_URL: hasSupabaseUrl,
    SUPABASE_ANON_KEY: hasSupabaseAnonKey,
    VITE_SUPABASE_URL: hasViteSupabaseUrl,
    VITE_SUPABASE_ANON_KEY: hasViteSupabaseAnonKey,
    OPENROUTER_API_KEY: hasEnvValue("OPENROUTER_API_KEY"),
    aiAuthAnonKeyAvailable: hasSupabaseAnonKey || hasViteSupabaseAnonKey,
    aiAuthConfigured:
      (hasSupabaseUrl || hasViteSupabaseUrl) &&
      (hasSupabaseAnonKey || hasViteSupabaseAnonKey),
    aiAuthUrlAvailable: hasSupabaseUrl || hasViteSupabaseUrl,
  };
}

function logStartupEnvironmentDiagnostics() {
  const diagnostics = getStartupEnvironmentDiagnostics();

  console.info("[ORBIT Env Diagnostics]", diagnostics);

  if (!diagnostics.aiAuthConfigured) {
    console.warn(
      "[ORBIT Env Diagnostics] AI auth env missing. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.",
    );
  }
}

if (NODE_ENV !== "test") {
  logStartupEnvironmentDiagnostics();
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet(getHelmetOptions()));

app.use(compression());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = normalizeCorsOrigin(origin);

      if (
        allowedOrigins.includes(cleanOrigin) ||
        isDevelopmentCorsOrigin(cleanOrigin)
      ) {
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
app.use(
  ["/api/knowledge", "/api/v1/knowledge"],
  requireRouteHandler("routes/knowledge.routes.js", knowledgeRoutes),
);

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
