/* =====================================================
   SERVER.JS — CV FOR U (PRODUCTION SAFE)
===================================================== */

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const helmet = require("helmet");
const compression = require("compression");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

const app = express();
app.set("trust proxy", 1);

/* =====================================================
   FORCE SINGLE DOMAIN (VERY IMPORTANT)
===================================================== */
app.use((req, res, next) => {
  if (req.headers.host === "www.cvforu.co.za") {
    return res.redirect(301, "https://cvforu.co.za" + req.url);
  }
  next();
});

/* =====================================================
   SECURITY
===================================================== */
app.use(helmet());
app.use(compression());
app.use(cookieParser());

/* =====================================================
   CORS
===================================================== */
app.use(
  cors({
    origin: "https://cvforu.co.za",
    credentials: true
  })
);

/* =====================================================
   PAYFAST RAW BODY
===================================================== */
app.use(
  "/api/payfast/notify",
  bodyParser.raw({ type: "application/x-www-form-urlencoded" })
);

/* =====================================================
   BODY PARSERS
===================================================== */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

/* =====================================================
   STATIC
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
   HEALTH
===================================================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* =====================================================
   START SERVER
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
