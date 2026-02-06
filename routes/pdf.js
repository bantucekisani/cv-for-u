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
    headless: chromium.headless
  });

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

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
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

    const html = renderCvHTML(cv);
    const pdf = await renderPdf(html, cvCss);

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
   COVER LETTER PDF (IPN-SAFE)
====================================================== */
router.get("/cover-letter/:id", auth, async (req, res) => {
  try {
    const cvId = req.params.id;

    // 🔁 ALWAYS RELOAD FRESH STATE
    let cv = await CV.findOne({
      _id: cvId,
      userId: req.user.id
    });

    if (!cv || !cv.coverLetter) {
      return res.status(404).send("Cover letter not found");
    }

    const now = Date.now();

    let allowDownload = false;

    // ✅ NORMAL CREDIT
    if ((cv.coverLettersRemaining || 0) > 0) {
      allowDownload = true;

      await CV.findByIdAndUpdate(cvId, {
        $inc: { coverLettersRemaining: -1 }
      });
    }

    // ✅ GRACE UNLOCK (ONE-TIME)
    else if (
      cv.pendingCoverUnlock === true &&
      now - (cv.pendingCoverUnlockAt || 0) < 5 * 60 * 1000
    ) {
      allowDownload = true;

      await CV.findByIdAndUpdate(cvId, {
        $unset: {
          pendingCoverUnlock: "",
          pendingCoverUnlockAt: ""
        }
      });
    }

    // ❌ BLOCK
    if (!allowDownload) {
      return res.status(402).send("Cover letter payment required");
    }

    // 🔁 FETCH AGAIN (FINAL STATE)
    cv = await CV.findById(cvId);

    const html = `
      <div class="cover-letter">
        ${cv.coverLetter
          .split("\n")
          .map(l => `<p>${l || "&nbsp;"}</p>`)
          .join("")}
      </div>
    `;

    const pdf = await renderPdf(html, coverCss);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Cover_Letter.pdf"
    });

    return res.send(pdf);

  } catch (err) {
    console.error("❌ COVER LETTER PDF ERROR:", err);
    return res.status(500).send("Cover letter PDF failed");
  }
});


module.exports = router;
