const express = require("express");

const router = express.Router();
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const fs = require("fs");
const path = require("path");

const CV = require("../models/Cv");
const auth = require("../middleware/auth");
const authViaQuery = require("../middleware/authViaQuery");
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
  console.warn("CV CSS not found");
}

try {
  coverCss = fs.readFileSync(
    path.join(__dirname, "../assets/css/cover-letter.css"),
    "utf8"
  );
} catch {
  console.warn("Cover letter CSS not found");
}

/* ======================================================
   PDF RENDERER
====================================================== */
async function renderPdf(html, css) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1200,
      height: 1697,
      deviceScaleFactor: 1
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

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  } finally {
    await browser.close();
  }
}

function pdfAuth(req, res, next) {
  if (req.query.token) {
    return authViaQuery(req, res, next);
  }

  return auth(req, res, next);
}

function setPdfHeaders(res, filename, pdf) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(pdf.length),
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff"
  });
}

async function getOwnedCv(req) {
  return CV.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
}

async function sendCvPdf(req, res) {
  try {
    const cv = await getOwnedCv(req);

    if (!cv) {
      return res.status(404).send("CV not found");
    }

    if ((cv.downloadsRemaining || 0) <= 0) {
      return res.status(402).send("CV payment required");
    }

    const html = renderCvHTML(cv);
    const pdf = await renderPdf(html, cvCss);

    await CV.updateOne(
      { _id: cv._id },
      { $inc: { downloadsRemaining: -1 } }
    );

    setPdfHeaders(res, "CV.pdf", pdf);
    res.send(pdf);
  } catch (err) {
    console.error("CV PDF ERROR:", err);
    res.status(500).send("CV PDF failed");
  }
}

async function sendCoverLetterPdf(req, res) {
  try {
    const cv = await getOwnedCv(req);

    if (!cv || !cv.coverLetter) {
      return res.status(404).send("Cover letter not found");
    }

    if ((cv.coverLettersRemaining || 0) <= 0) {
      return res.status(402).send("Cover letter payment required");
    }

    const lines = cv.coverLetter
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const html = `
      <div class="cover-letter">
        <div class="address">
          ${lines.slice(0, 7).map(line => `<p>${line}</p>`).join("")}
        </div>
        <div class="body">
          ${lines.slice(7).map(line => `<p>${line}</p>`).join("")}
        </div>
      </div>
    `;

    const pdf = await renderPdf(html, coverCss);

    await CV.updateOne(
      { _id: cv._id },
      { $inc: { coverLettersRemaining: -1 } }
    );

    setPdfHeaders(res, "Cover_Letter.pdf", pdf);
    res.send(pdf);
  } catch (err) {
    console.error("COVER LETTER PDF ERROR:", err);
    res.status(500).send("Cover letter PDF failed");
  }
}

/* ======================================================
   PDF ROUTES
====================================================== */
router.get("/cv/:id", pdfAuth, sendCvPdf);
router.post("/cv/:id", pdfAuth, sendCvPdf);

router.get("/cover-letter/:id", pdfAuth, sendCoverLetterPdf);
router.post("/cover-letter/:id", pdfAuth, sendCoverLetterPdf);

module.exports = router;
