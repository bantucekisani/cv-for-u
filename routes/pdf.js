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
const {
  blankPdfCacheEntry,
  buildPdfAssetKey,
  hashPayload,
  isPdfCacheFresh,
  readPdfAsset,
  writePdfAsset
} = require("../utils/pdfStore");

/* ======================================================
   LOAD SAME CSS AS PREVIEW
====================================================== */
let cvCss = "";
let coverCss = "";

function readCssFile(...candidates) {
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, "utf8");
    } catch {}
  }

  return "";
}

try {
  cvCss = readCssFile(
    path.join(__dirname, "../public/css/cv.css"),
    path.join(__dirname, "../assets/css/cv.css")
  );
} catch {
  console.warn("CV CSS not found");
}

try {
  coverCss = readCssFile(
    path.join(__dirname, "../public/css/cover-letter.css"),
    path.join(__dirname, "../assets/css/cover-letter.css")
  );
} catch {
  console.warn("Cover letter CSS not found");
}

const cvCssHash = hashPayload({ css: cvCss });
const coverCssHash = hashPayload({ css: coverCss });
const inflightPdfBuilds = new Map();
const maxRenderConcurrency = Math.max(
  1,
  Number.parseInt(process.env.PDF_RENDER_CONCURRENCY || "2", 10) || 2
);

let browserPromise = null;
let activeRenders = 0;
const renderWaiters = [];

/* ======================================================
   PDF RENDERER
====================================================== */
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    }).catch(err => {
      browserPromise = null;
      throw err;
    });
  }

  return browserPromise;
}

async function resetBrowser() {
  if (!browserPromise) {
    return;
  }

  const currentBrowser = await browserPromise.catch(() => null);
  browserPromise = null;

  if (currentBrowser) {
    await currentBrowser.close().catch(() => {});
  }
}

function acquireRenderSlot() {
  if (activeRenders < maxRenderConcurrency) {
    activeRenders += 1;
    return Promise.resolve();
  }

  return new Promise(resolve => {
    renderWaiters.push(resolve);
  });
}

function releaseRenderSlot() {
  activeRenders = Math.max(0, activeRenders - 1);

  const next = renderWaiters.shift();

  if (next) {
    activeRenders += 1;
    next();
  }
}

async function withRenderSlot(task) {
  await acquireRenderSlot();

  try {
    return await task();
  } finally {
    releaseRenderSlot();
  }
}

async function renderPdf(html, css) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1200,
      height: 1697,
      deviceScaleFactor: 2
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

    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    return await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  } catch (err) {
    await resetBrowser();
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

function pdfAuth(req, res, next) {
  if (req.query.token) {
    return authViaQuery(req, res, next);
  }

  return auth(req, res, next);
}

function wantsInlinePdf(req) {
  return String(req.query.inline || "") === "1";
}

function setPdfHeaders(res, filename, pdf, { inline = false } = {}) {
  const dispositionType = inline ? "inline" : "attachment";

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${dispositionType}; filename="${filename}"`,
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

function buildCvFingerprint(cv) {
  return hashPayload({
    kind: "cv",
    cssHash: cvCssHash,
    template: cv.template || "",
    color: cv.color || "",
    photo: cv.photo || "",
    name: cv.name || "",
    title: cv.title || "",
    email: cv.email || "",
    phone: cv.phone || "",
    location: cv.location || "",
    summary: cv.summary || "",
    skills: Array.isArray(cv.skills) ? cv.skills : [],
    experience: Array.isArray(cv.experience) ? cv.experience : [],
    education: Array.isArray(cv.education) ? cv.education : [],
    references: Array.isArray(cv.references) ? cv.references : [],
    referencesOnRequest: cv.referencesOnRequest === true
  });
}

function buildCoverLetterFingerprint(cv) {
  return hashPayload({
    kind: "cover-letter",
    cssHash: coverCssHash,
    coverLetter: cv.coverLetter || ""
  });
}

function getPdfCacheEntry(cv, kind) {
  return cv?.pdfCache?.[kind] || blankPdfCacheEntry();
}

function buildPdfCacheEntry(assetKey, fingerprint, pdfBuffer) {
  return {
    status: "ready",
    key: assetKey,
    fingerprint,
    generatedAt: new Date(),
    sizeBytes: Buffer.byteLength(pdfBuffer),
    error: ""
  };
}

async function setPdfCacheState(cvId, kind, state) {
  await CV.updateOne(
    { _id: cvId },
    { $set: { [`pdfCache.${kind}`]: state } }
  );
}

async function setPdfCacheQueued(cvId, kind, assetKey, fingerprint) {
  await setPdfCacheState(cvId, kind, {
    ...blankPdfCacheEntry(),
    status: "queued",
    key: assetKey,
    fingerprint
  });
}

async function setPdfCacheError(cvId, kind, assetKey, fingerprint, err) {
  await setPdfCacheState(cvId, kind, {
    ...blankPdfCacheEntry(),
    status: "error",
    key: assetKey,
    fingerprint,
    error: String(err?.message || err || "PDF render failed").slice(0, 400)
  });
}

async function claimDownloadCredit(cvId, field) {
  return CV.findOneAndUpdate(
    {
      _id: cvId,
      [field]: { $gt: 0 }
    },
    {
      $inc: { [field]: -1 }
    },
    {
      new: true
    }
  );
}

async function getFreshCachedPdf(cv, kind, assetKey, fingerprint) {
  const cacheEntry = getPdfCacheEntry(cv, kind);

  if (!isPdfCacheFresh(cacheEntry, { key: assetKey, fingerprint })) {
    return null;
  }

  return readPdfAsset(assetKey);
}

async function getOrBuildPdfAsset(assetKey, buildFn) {
  const cached = await readPdfAsset(assetKey);

  if (cached) {
    return cached;
  }

  if (inflightPdfBuilds.has(assetKey)) {
    return inflightPdfBuilds.get(assetKey);
  }

  const buildPromise = withRenderSlot(async () => {
    const freshCached = await readPdfAsset(assetKey);

    if (freshCached) {
      return freshCached;
    }

    const pdf = await buildFn();
    await writePdfAsset(assetKey, pdf);
    return pdf;
  }).finally(() => {
    inflightPdfBuilds.delete(assetKey);
  });

  inflightPdfBuilds.set(assetKey, buildPromise);
  return buildPromise;
}

async function buildCvPdf(cv) {
  const html = renderCvHTML(cv);
  return renderPdf(html, cvCss);
}

async function buildCoverLetterPdf(cv) {
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

  return renderPdf(html, coverCss);
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

    const fingerprint = buildCvFingerprint(cv);
    const assetKey = buildPdfAssetKey({
      kind: "cv",
      cvId: cv._id.toString(),
      fingerprint
    });

    let pdf = await getFreshCachedPdf(cv, "cv", assetKey, fingerprint);

    if (!pdf) {
      await setPdfCacheQueued(cv._id, "cv", assetKey, fingerprint);

      try {
        pdf = await getOrBuildPdfAsset(assetKey, () => buildCvPdf(cv));
        await setPdfCacheState(
          cv._id,
          "cv",
          buildPdfCacheEntry(assetKey, fingerprint, pdf)
        );
      } catch (err) {
        await setPdfCacheError(cv._id, "cv", assetKey, fingerprint, err);
        throw err;
      }
    }

    const creditClaim = await claimDownloadCredit(cv._id, "downloadsRemaining");

    if (!creditClaim) {
      return res.status(402).send("CV payment required");
    }

    setPdfHeaders(res, "CV.pdf", pdf, {
      inline: wantsInlinePdf(req)
    });
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

    const fingerprint = buildCoverLetterFingerprint(cv);
    const assetKey = buildPdfAssetKey({
      kind: "cover-letter",
      cvId: cv._id.toString(),
      fingerprint
    });

    let pdf = await getFreshCachedPdf(cv, "coverLetter", assetKey, fingerprint);

    if (!pdf) {
      await setPdfCacheQueued(cv._id, "coverLetter", assetKey, fingerprint);

      try {
        pdf = await getOrBuildPdfAsset(assetKey, () => buildCoverLetterPdf(cv));
        await setPdfCacheState(
          cv._id,
          "coverLetter",
          buildPdfCacheEntry(assetKey, fingerprint, pdf)
        );
      } catch (err) {
        await setPdfCacheError(cv._id, "coverLetter", assetKey, fingerprint, err);
        throw err;
      }
    }

    const creditClaim = await claimDownloadCredit(cv._id, "coverLettersRemaining");

    if (!creditClaim) {
      return res.status(402).send("Cover letter payment required");
    }

    setPdfHeaders(res, "Cover_Letter.pdf", pdf, {
      inline: wantsInlinePdf(req)
    });
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
