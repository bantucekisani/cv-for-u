const express = require("express");
console.log("🔥 routes/pdf.js LOADED");

const router = express.Router();
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const fs = require("fs");
const path = require("path");

const CV = require("../models/Cv");
const auth = require("../middleware/auth");
const renderCvHTML = require("../utils/renderTemplate");


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
   PDF RENDERER — RENDER FREE SAFE
====================================================== */
async function renderPdf(html, css) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1200,
    height: 1697,
    deviceScaleFactor: 1,
  });

  await page.emulateMediaType("screen");

  await page.setContent(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${css}
    body { margin: 0; background: #fff; }
  </style>
</head>
<body class="pdf-mode">
  ${html}
</body>
</html>`,
    { waitUntil: "networkidle0" }
  );

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  return pdf;
}

/* ======================================================
   CV PDF
====================================================== */
router.post("/cv/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!cv) return res.status(404).send("CV not found");

    if ((cv.downloadsRemaining || 0) <= 0) {
      return res.status(402).send("CV payment required");
    }

    // ✅ SERVER RENDER (SAME AS PREVIEW)
    const html = renderCvHTML(cv);

    const pdf = await renderPdf(html, cvCss);

    // ✅ DECREMENT ONLY AFTER SUCCESS
    await CV.updateOne(
      { _id: cv._id },
      { $inc: { downloadsRemaining: -1 } }
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=CV.pdf"
    });

    res.send(pdf);

  } catch (err) {
    console.error("❌ CV PDF ERROR:", err);
    res.status(500).send("CV PDF failed");
  }
});

/* ======================================================
   COVER LETTER PDF
====================================================== */
router.get("/cover-letter/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!cv) return res.status(404).send("CV not found");

    if (!cv.coverLetter?.trim()) {
      return res.status(404).send("Cover letter not found");
    }

    // ✅ FIRST DOWNLOAD FREE
    if (cv.coverLettersRemaining == null) {
      cv.coverLettersRemaining = 1;
      await cv.save();
    }

    if (cv.coverLettersRemaining <= 0) {
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

    // ✅ DECREMENT ONLY AFTER SUCCESS
    await CV.updateOne(
      { _id: cv._id },
      { $inc: { coverLettersRemaining: -1 } }
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Cover_Letter.pdf"
    });

    res.send(pdf);

  } catch (err) {
    console.error("❌ COVER LETTER PDF ERROR:", err);
    res.status(500).send("Cover letter PDF failed");
  }
});

module.exports = router;
