const express = require("express");
const axios = require("axios");
const router = express.Router();
const CV = require("../models/Cv");
const Payment = require("../models/Payment");

/* ======================================================
   PAYFAST IPN NOTIFY
====================================================== */
router.post("/notify", async (req, res) => {
  try {
    console.log("🔥 PAYFAST IPN HIT");

    const rawBody = req.body.toString();

    const data = Object.fromEntries(
      rawBody.split("&").map(pair => {
        const [k, v] = pair.split("=");
        return [k, decodeURIComponent(v || "").replace(/\+/g, " ")];
      })
    );

    /* =========================
       1️⃣ PAYMENT STATUS
    ========================= */
    if (data.payment_status !== "COMPLETE") {
      return res.status(200).send("Ignored");
    }

    /* =========================
       2️⃣ PAYFAST SERVER VERIFY
    ========================= */
    const pfHost =
      process.env.PAYFAST_MODE === "live"
        ? "https://www.payfast.co.za"
        : "https://sandbox.payfast.co.za";

    const verifyRes = await axios.post(
      `${pfHost}/eng/query/validate`,
      rawBody,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (verifyRes.data !== "VALID") {
      console.error("❌ PAYFAST VALIDATION FAILED");
      return res.status(400).send("Validation failed");
    }

    /* =========================
       3️⃣ NORMALISE PAYMENT DATA
    ========================= */
    const paymentId = data.m_payment_id;
    const amount = Math.round(Number(data.amount_gross || 0) * 100) / 100;

    // 🔥 EXTRACT USER + CV FROM PAYMENT ID
    const parts = paymentId.split("-");
    const userId = parts[parts.length - 2];   // 🔥 userId
    const type = parts[0];                    // cv | cover-letter

    console.log("💳 APPLYING PAYMENT:", paymentId, amount, userId);

    /* =========================
       4️⃣ IDEMPOTENCY
    ========================= */
    const existing = await Payment.findOne({ paymentId });
    if (existing) {
      return res.status(200).send("Already processed");
    }

    /* =========================
       5️⃣ SAVE PAYMENT RECORD
    ========================= */
    const payment = await Payment.create({
      paymentId,
      userId,                                 // 🔥 FIXED
      provider: "payfast",
      amount,
      status: "COMPLETE",
      type
    });

    /* ==================================================
       CV PURCHASE — R40
    ================================================== */
    if (type === "cv" && amount === 40) {
      const cvId = parts[1];

      await CV.findByIdAndUpdate(cvId, {
        $set: { isPaid: true },
        $inc: {
          downloadsRemaining: 4,
          coverLettersRemaining: 1
        }
      });

      payment.cvId = cvId;
      await payment.save();
    }

    /* ==================================================
       COVER LETTER — R25
    ================================================== */
    if (type === "cover-letter" && amount === 25) {
  const cvId = parts[1];

  await CV.findByIdAndUpdate(
    cvId,
    {
      $setOnInsert: { coverLettersRemaining: 0 },
      $inc: { coverLettersRemaining: 1 }
    },
    { upsert: false }
  );

  payment.cvId = cvId;
  await payment.save();
}

    return res.status(200).send("OK");

  } catch (err) {
    console.error("❌ PAYFAST IPN ERROR:", err);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
