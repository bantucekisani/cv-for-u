const express = require("express");
console.log("🔥 routes/pdf.js LOADED");

const router = express.Router();
const puppeteer = require("puppeteer");
const chromium = require("@sparticuz/chromium");


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
   PDF RENDERER — RENDER SAFE
====================================================== */
async function renderPdf(html, css) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  });

  const page = await browser.newPage();

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

    if (!cv) {
      return res.status(404).send("CV not found");
    }

    if ((cv.downloadsRemaining || 0) <= 0) {
      return res.status(402).send("CV payment required");
    }

    const pdf = await renderPdf(req.body.html, cvCss);

    await CV.updateOne(
      { _id: cv._id },
      { $inc: { downloadsRemaining: -1 } }
    );

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=CV.pdf",
      "Content-Length": pdf.length
    });

    res.end(pdf);

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

    // 1️⃣ CV exists
    if (!cv) {
      return res.status(404).send("CV not found");
    }

    // 2️⃣ Cover letter exists
    if (!cv.coverLetter || cv.coverLetter.trim() === "") {
      return res.status(404).send("Cover letter not found");
    }

    // 3️⃣ Credits available
    if (cv.coverLettersRemaining <= 0) {
      return res.status(402).send("Cover letter payment required");
    }

    // 4️⃣ Build HTML safely
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

    // 5️⃣ Generate PDF (this may throw — that’s GOOD)
    const pdf = await renderPdf(html, coverCss);

    // 6️⃣ ONLY NOW decrement credits
    await CV.updateOne(
      { _id: cv._id },
      { $inc: { coverLettersRemaining: -1 } }
    );

    // 7️⃣ Send file
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Cover_Letter.pdf",
      "Content-Length": pdf.length
    });

    return res.status(200).end(pdf);

  } catch (err) {
    console.error("❌ COVER LETTER PDF ERROR:", err);
    return res.status(500).send("Cover letter PDF failed");
  }
});

module.exports = router;
