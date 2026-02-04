const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const CV = require("../models/Cv");

/* ======================================================
   PAYFAST CREATE PAYMENT
   POST /api/payfast/create
====================================================== */
router.post("/create", auth, async (req, res) => {
  try {
    const { cvId, type } = req.body;

    /* ============================
       1️⃣ VALIDATE PAYMENT TYPE
    ============================ */
    if (!["cv", "cover-letter"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type"
      });
    }

    /* ============================
       2️⃣ CV OWNERSHIP CHECK
    ============================ */
    let cv = null;

    if (type === "cv" || type === "cover-letter") {
      if (!cvId) {
        return res.status(400).json({
          success: false,
          message: "CV ID required"
        });
      }

      cv = await CV.findOne({
        _id: cvId,
        userId: req.user.id
      });

      if (!cv) {
        return res.status(404).json({
          success: false,
          message: "CV not found"
        });
      }
    }

    /* ============================
       3️⃣ SERVER-SIDE PRICING
       (NEVER TRUST FRONTEND)
    ============================ */
    const PRICES = {
      cv: 40.0,           // R40 → 4 downloads + 1 cover letter
      "cover-letter": 25.0 // R25 → 1 cover letter
    };

    const amount = PRICES[type];

    /* ============================
       4️⃣ PUBLIC URL
    ============================ */
    const PUBLIC_URL =
      process.env.PUBLIC_URL ||
      "https://querulous-interresponsible-carleen.ngrok-free.dev";

    /* ============================
       5️⃣ PAYMENT METADATA
    ============================ */
    const itemName =
      type === "cv" ? "CV Unlock" : "AI Cover Letter";

    // 🔑 UNIQUE PAYMENT ID (USED BY IPN)
    // examples:
    // cv-65f123abc-1700000000000
    // cover-letter-65f123abc-1700000000000
    const paymentId = `${type}-${cvId}-${req.user.id}-${Date.now()}`;


    const returnUrl =
      `${PUBLIC_URL}/payment-success.html?type=${type}&cv=${cvId}`;

    const cancelUrl = `${PUBLIC_URL}/payment-cancel.html`;
    const notifyUrl = `${PUBLIC_URL}/api/payfast/notify`;

    /* ============================
       6️⃣ PAYFAST PAYLOAD
    ============================ */
    const paymentData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,

      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,

      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: itemName
    };

    /* ============================
       7️⃣ REDIRECT URL
    ============================ */
    const query = new URLSearchParams(paymentData).toString();

    const PAYFAST_URL =
      process.env.PAYFAST_MODE === "live"
        ? "https://www.payfast.co.za/eng/process"
        : "https://sandbox.payfast.co.za/eng/process";

    return res.json({
      success: true,
      redirectUrl: `${PAYFAST_URL}?${query}`
    });

  } catch (err) {
    console.error("❌ PAYFAST CREATE ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Payment creation failed"
    });
  }
});

module.exports = router;
