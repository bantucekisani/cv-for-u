/* =====================================================
   SERVER.JS — CV FOR U
===================================================== */

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const helmet = require("helmet");
const compression = require("compression");
const bodyParser = require("body-parser");

const connectDB = require("./config/db");



const app = express();
app.set("trust proxy", 1);

/* =====================================================
   SECURITY (OPTIONAL)
===================================================== */
// app.use(helmet());
// app.use(compression());

/* =====================================================
   CORS
===================================================== */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Required for local network access (Chrome)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

/* =====================================================
   🔥 PAYFAST RAW BODY (CRITICAL)
   MUST be BEFORE express.urlencoded()
===================================================== */
app.use(
  "/api/payfast/notify",
  bodyParser.raw({ type: "application/x-www-form-urlencoded" })
);

/* =====================================================
   NORMAL BODY PARSERS
   (ALL NON-PAYFAST ROUTES)
===================================================== */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));



/* =====================================================
   STATIC FRONTEND
===================================================== */
app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   ROUTES
===================================================== */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/cv", require("./routes/cv"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/pdf", require("./routes/pdf"));

app.use("/api/payfast", require("./routes/payfast"));
app.use("/api/payfast", require("./routes/payfast-notify"));
app.use("/api/admin", require("./routes/admin"));


/* =====================================================
   HEALTH CHECK
===================================================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* =====================================================
   START SERVER (RENDER-SAFE)
===================================================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  try {
    await connectDB();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
});
