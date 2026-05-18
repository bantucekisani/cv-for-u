const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

function buildAllowedOrigins() {
  const normalizeOrigin = value => String(value || "").trim().replace(/\/+$/, "");
  const fromEnv = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  const defaults = [
    process.env.PUBLIC_URL,
    process.env.APP_URL,
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000"
  ].map(normalizeOrigin).filter(Boolean);

  return new Set([...defaults, ...fromEnv]);
}

const allowedOrigins = buildAllowedOrigins();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many AI requests. Please slow down and try again."
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com"
      ],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "font-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'", "https://www.payfast.co.za", "https://sandbox.payfast.co.za"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    next();
  });
}

app.use(
  "/api/payfast/notify",
  bodyParser.raw({ type: "application/x-www-form-urlencoded" })
);

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));
app.use(express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT || "2mb" }));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/cv", require("./routes/cv"));
app.use("/api/ai", aiLimiter, require("./routes/ai"));
app.use("/api/pdf", require("./routes/pdf"));
app.use("/api/payfast", require("./routes/payfast"));
app.use("/api/payfast", require("./routes/payfast-notify"));
app.use("/api/admin", require("./routes/admin"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed"
    });
  }

  return next(err);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await connectDB();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
});
