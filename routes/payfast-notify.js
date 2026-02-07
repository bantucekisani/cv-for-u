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

    // -----------------------------
    // Parse PayFast payload
    // -----------------------------
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
      console.warn("⚠️ Payment not complete:", data.payment_status);
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

let type = null;
let cvId = null;
let userId = null;

const parts = paymentId.split("-");

if (paymentId.startsWith("cover-letter-")) {
  type = "cover-letter";
  cvId = parts[2];    // ✅ correct
  userId = parts[3];  // ✅ correct
} 
else if (paymentId.startsWith("cv-")) {
  type = "cv";
  cvId = parts[1];
  userId = parts[2];
} 
else {
  console.error("❌ Unknown paymentId format:", paymentId);
  return res.status(400).send("Invalid payment ID");
}


    console.log("💳 APPLYING PAYMENT:", {
      paymentId,
      type,
      cvId,
      userId,
      amount
    });

    /* =========================
       4️⃣ IDEMPOTENCY CHECK
    ========================= */
    const existing = await Payment.findOne({ paymentId });
    if (existing) {
      console.warn("⚠️ Payment already processed:", paymentId);
      return res.status(200).send("Already processed");
    }

    /* =========================
       5️⃣ SAVE PAYMENT RECORD
    ========================= */
    const payment = await Payment.create({
      paymentId,
      userId,
      cvId,
      provider: "payfast",
      amount,
      status: "COMPLETE",
      type
    });

    /* ==================================================
       CV PURCHASE — R40
    ================================================== */
    if (type === "cv" && amount === 40) {
      await CV.findByIdAndUpdate(cvId, {
        $set: { isPaid: true },
        $inc: {
          downloadsRemaining: 4,
          coverLettersRemaining: 1
        }
      });

      console.log("✅ CV credits applied");
    }

    
  /* ==================================================
   COVER LETTER PURCHASE — R25 (IDENTICAL TO CV FLOW)
================================================== */
if (type === "cover-letter") {
  await CV.findByIdAndUpdate(cvId, {
    $set: { isPaid: true },
    $inc: {
      coverLettersRemaining: 1
    }
  });

  console.log("✅ Cover letter credit applied (R25)");
}
   

    return res.status(200).send("OK");

  } catch (err) {
    console.error("❌ PAYFAST IPN ERROR:", err);
    return res.status(500).send("Server error");
  }
});
/* ======================================================
   CONFIRM COVER LETTER PAYMENT (SERVER-SIDE)
   GET /api/payfast/confirm-cover/:cvId
====================================================== */
router.get("/confirm-cover/:cvId", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.cvId,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).json({ success: false });
    }

    // 🔥 IPN already applied credit — just confirm
    if ((cv.coverLettersRemaining || 0) > 0) {
      return res.json({ success: true });
    }

    return res.status(402).json({ success: false });

  } catch (err) {
    console.error("❌ CONFIRM COVER PAYMENT ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
