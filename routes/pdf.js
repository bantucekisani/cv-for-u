const express = require("express");
console.log("🔥 routes/pdf.js LOADED");

const router = express.Router();
const { chromium } = require("playwright");

const fs = require("fs");
const path = require("path");

const CV = require("../models/Cv");
const auth = require("../middleware/auth");

/* ======================================================
   LOAD SAME CSS AS PREVIEW
====================================================== */
let cvCss = "";
let coverCss = "";

try {
  cvCss = fs.readFileSync(
    path.join(__dirname, "../assets/css/cv.css"),
    "utf8"
  );
} catch {
  console.warn("⚠️ CV CSS not found");
}

try {
  coverCss = fs.readFileSync(
    path.join(__dirname, "../assets/css/cover-letter.css"),
    "utf8"
  );
} catch {
  console.warn("⚠️ Cover letter CSS not found");
}

/* ======================================================
   PDF RENDERER — DESKTOP LOCK (FINAL)
====================================================== */
async function renderPdf(html, css) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage({
    viewport: {
      width: 1200,
      height: 1697
    }
  });

  await page.setContent(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${css}
          body {
            margin: 0;
            background: #ffffff;
          }
        </style>
      </head>
      <body class="pdf-mode">
        ${html}
      </body>
    </html>
    `,
    { waitUntil: "domcontentloaded" }
  );

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0"
    }
  });

  await browser.close();
  return pdf;
}


/* ======================================================
   CV PDF — EXACT PREVIEW MATCH (FIXED)
====================================================== */
router.post("/cv/:id", auth, async (req, res) => {
  try {
    console.log("⬇️ CV PDF REQUEST");

    const cv = await CV.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).send("CV not found");
    }

    if ((cv.downloadsRemaining || 0) <= 0) {
      return res.status(402).send("No CV downloads remaining");
    }

    const { html } = req.body;

    if (!html) {
      return res.status(400).send("No preview HTML received");
    }

    // ✅ DO NOT WRAP — FRONTEND HTML IS ALREADY CORRECT
    const pdf = await renderPdf(html, cvCss);

    await CV.findByIdAndUpdate(
      cv._id,
      {
        $inc: { downloadsRemaining: -1 },
        $set: { lastDownloadedAt: new Date() }
      }
    );

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=CV.pdf",
      "Content-Length": pdf.length
    });

    res.end(pdf);

    console.log("✅ CV PDF GENERATED");

  } catch (err) {
    console.error("❌ CV PDF ERROR:", err);
    res.status(500).send(`PDF FAILED: ${err.message}`);
  }
});

/* ======================================================
   COVER LETTER PDF (UNCHANGED)
====================================================== */
router.get("/cover-letter/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!cv || !cv.coverLetter) {
      return res.status(404).send("Cover letter not found");
    }

    if ((cv.coverLettersRemaining || 0) <= 0) {
      return res.status(402).send("Cover letter payment required");
    }

    const lines = cv.coverLetter.split("\n");

    const html = `
      <div class="cover-letter">
        <div class="address">
          ${lines.slice(0, 7).map(l => `<p>${l}</p>`).join("")}
        </div>
        <div class="body">
          ${lines.slice(7).map(l => `<p>${l}</p>`).join("")}
        </div>
      </div>
    `;

    const pdf = await renderPdf(html, coverCss);

    await CV.updateOne(
      { _id: cv._id },
      { $inc: { coverLettersRemaining: -1 } }
    );

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Cover_Letter.pdf",
      "Content-Length": pdf.length
    });

    res.end(pdf);

  } catch (err) {
    console.error("❌ COVER LETTER PDF ERROR:", err);
    res.status(500).send("Cover letter PDF failed");
  }
});

module.exports = router;
