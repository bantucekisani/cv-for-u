const express = require("express");
const axios = require("axios");

const CV = require("../models/Cv");
const Payment = require("../models/Payment");
const {
  getPurchaseConfig,
  matchesAmount
} = require("../utils/paymentPlans");

const router = express.Router();

function parsePayfastPayload(rawBody) {
  return Object.fromEntries(
    rawBody.split("&").map(pair => {
      const [key, value] = pair.split("=");
      return [key, decodeURIComponent(value || "").replace(/\+/g, " ")];
    })
  );
}

function parsePaymentId(paymentId) {
  const parts = String(paymentId || "").split("-");

  if (paymentId.startsWith("cover-letter-")) {
    return {
      type: "cover-letter",
      cvId: parts[2],
      userId: parts[3]
    };
  }

  if (paymentId.startsWith("cv-")) {
    return {
      type: "cv",
      cvId: parts[1],
      userId: parts[2]
    };
  }

  return null;
}

/* ======================================================
   PAYFAST IPN NOTIFY
   POST /api/payfast/notify
====================================================== */
router.post("/notify", async (req, res) => {
  try {
    const rawBody = req.body.toString();
    const data = parsePayfastPayload(rawBody);

    if (data.payment_status !== "COMPLETE") {
      return res.status(200).send("Ignored");
    }

    const payfastHost =
      process.env.PAYFAST_MODE === "live"
        ? "https://www.payfast.co.za"
        : "https://sandbox.payfast.co.za";

    const verifyRes = await axios.post(
      `${payfastHost}/eng/query/validate`,
      rawBody,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (verifyRes.data !== "VALID") {
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

    await CV.findByIdAndUpdate(parsed.cvId, {
      $set: { isPaid: true },
      $inc: purchase.credits
    });

    return res.status(200).send("OK");
  } catch (err) {
    console.error("PAYFAST IPN ERROR:", err);
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
