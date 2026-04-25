const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const PDF_STORAGE_ROOT = path.resolve(
  process.env.PDF_STORAGE_DIR ||
  path.join(__dirname, "../storage/generated-pdfs")
);

function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function sanitiseSegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function buildPdfAssetKey({ kind, cvId, fingerprint }) {
  const safeKind = sanitiseSegment(kind);
  const safeCvId = sanitiseSegment(cvId);
  const safeFingerprint = sanitiseSegment(fingerprint).slice(0, 64);

  return `${safeKind}/${safeCvId}/${safeFingerprint}.pdf`;
}

function resolveAssetPath(key) {
  const assetPath = path.resolve(
    PDF_STORAGE_ROOT,
    String(key || "").replace(/\//g, path.sep)
  );

  if (!assetPath.startsWith(PDF_STORAGE_ROOT)) {
    throw new Error("Invalid PDF asset path");
  }

  return assetPath;
}

function blankPdfCacheEntry() {
  return {
    status: "idle",
    key: "",
    fingerprint: "",
    generatedAt: null,
    sizeBytes: 0,
    error: ""
  };
}

function isPdfCacheFresh(entry, { key, fingerprint }) {
  return Boolean(
    entry &&
    entry.status === "ready" &&
    entry.key === key &&
    entry.fingerprint === fingerprint
  );
}

async function readPdfAsset(key) {
  if (!key) {
    return null;
  }

  try {
    return await fsp.readFile(resolveAssetPath(key));
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

async function writePdfAsset(key, pdfBuffer) {
  const assetPath = resolveAssetPath(key);
  const dir = path.dirname(assetPath);
  const tempPath = `${assetPath}.tmp-${process.pid}-${Date.now()}`;

  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tempPath, pdfBuffer);
  await fsp.rename(tempPath, assetPath);

  return {
    path: assetPath,
    sizeBytes: Buffer.byteLength(pdfBuffer)
  };
}

module.exports = {
  PDF_STORAGE_ROOT,
  blankPdfCacheEntry,
  buildPdfAssetKey,
  hashPayload,
  isPdfCacheFresh,
  readPdfAsset,
  writePdfAsset
};
