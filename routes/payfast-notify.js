const express = require("express");
const axios = require("axios");

const CV = require("../models/Cv");
const Payment = require("../models/Payment");
const {
  getPurchaseConfig,
  matchesAmount
} = require("../utils/paymentPlans");
const {
  assertConfigured,
  getValidationUrl
} = require("../utils/payfastConfig");

const router = express.Router();

function parsePayfastPayload(rawBody) {
  return Object.fromEntries(
    String(rawBody || "")
      .split("&")
      .filter(Boolean)
      .map(pair => {
        const separatorIndex = pair.indexOf("=");
        const key = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
        const value = separatorIndex === -1 ? "" : pair.slice(separatorIndex + 1);

        return [key, decodeURIComponent(value.replace(/\+/g, " "))];
      })
  );
}

function parsePaymentId(paymentId) {
  const raw = String(paymentId || "");
  const type = ["cover-letter", "job-finder", "cv"]
    .find(value => raw.startsWith(`${value}-`));

  if (!type) {
    return null;
  }

  const [cvId, userId] = raw.slice(type.length + 1).split("-");
  if (!cvId || !userId) {
    return null;
  }

  return { type, cvId, userId };
}

/* ======================================================
   PAYFAST IPN NOTIFY
   POST /api/payfast/notify
====================================================== */
router.post("/notify", async (req, res) => {
  try {
    assertConfigured();

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body || "");

    if (!rawBody) {
      return res.status(400).send("Missing payload");
    }

    const data = parsePayfastPayload(rawBody);

    if (data.payment_status !== "COMPLETE") {
      return res.status(200).send("Ignored");
    }

    const verifyRes = await axios.post(
      getValidationUrl(),
      rawBody,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000
      }
    );

    if (String(verifyRes.data || "").trim() !== "VALID") {
      console.error("PAYFAST VALIDATION FAILED");
      return res.status(400).send("Validation failed");
    }

    const paymentId = data.m_payment_id;
    const amount = Math.round(Number(data.amount_gross || 0) * 100) / 100;
    const parsed = parsePaymentId(paymentId);

    if (!parsed?.type || !parsed.cvId || !parsed.userId) {
      console.error("Invalid payment ID:", paymentId);
      return res.status(400).send("Invalid payment ID");
    }

    const purchase = getPurchaseConfig(parsed.type);
    if (!purchase || !matchesAmount(purchase, amount)) {
      console.error("Unexpected payment amount:", {
        paymentId,
        type: parsed.type,
        amount
      });
      return res.status(400).send("Unexpected payment amount");
    }

    const existingPayment = await Payment.findOne({ paymentId });
    if (existingPayment) {
      return res.status(200).send("Already processed");
    }

    try {
      await Payment.create({
        paymentId,
        userId: parsed.userId,
        cvId: parsed.cvId,
        provider: "payfast",
        amount,
        status: "COMPLETE",
        type: parsed.type
      });
    } catch (err) {
      console.error("PAYMENT SAVE ERROR:", err.message);
      return res.status(200).send("Already processed");
    }

    const update = {
      $inc: purchase.credits
    };

    if (parsed.type === "cv") {
      update.$set = { isPaid: true };
    }

    await CV.findByIdAndUpdate(parsed.cvId, update);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PAYFAST IPN ERROR:", err);

    if (err.message === "PayFast merchant credentials are not configured") {
      return res.status(503).send("PayFast not configured");
    }

    return res.status(500).send("Server error");
  }
});

/* ======================================================
   CONFIRM COVER LETTER PAYMENT
   GET /api/payfast/confirm-cover/:cvId
====================================================== */
router.get("/confirm-cover/:cvId", require("../middleware/auth"), async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.cvId,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).json({ success: false });
    }

    if ((cv.coverLettersRemaining || 0) > 0) {
      return res.json({ success: true });
    }

    return res.status(402).json({ success: false });
  } catch (err) {
    console.error("CONFIRM COVER PAYMENT ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
