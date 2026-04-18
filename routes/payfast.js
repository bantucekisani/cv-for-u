const express = require("express");
const rateLimit = require("express-rate-limit");

const auth = require("../middleware/auth");
const CV = require("../models/Cv");
const {
  getPurchaseConfig,
  formatAmount
} = require("../utils/paymentPlans");

const router = express.Router();
const createPaymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment attempts. Please try again later."
  }
});

/* ======================================================
   PAYFAST CREATE PAYMENT
   POST /api/payfast/create
====================================================== */
router.post("/create", auth, createPaymentLimiter, async (req, res) => {
  try {
    const { cvId, type, next } = req.body;
    const purchase = getPurchaseConfig(type);

    if (!purchase) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type"
      });
    }

    if (!cvId) {
      return res.status(400).json({
        success: false,
        message: "CV ID required"
      });
    }

    const cv = await CV.findOne({
      _id: cvId,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).json({
        success: false,
        message: "CV not found"
      });
    }

    if (purchase.type !== "cv" && cv.isPaid !== true) {
      return res.status(400).json({
        success: false,
        message: "Please pay for the CV first before buying add-ons"
      });
    }

    const nextStep = next === "job-finder" ? "job-finder" : "";
    const publicUrl =
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      "https://cv-for-u.onrender.com";

    const paymentId = `${purchase.type}-${cvId}-${req.user.id}-${Date.now()}`;
    const returnUrl = `${publicUrl}/payment-success.html?type=${purchase.type}&cv=${cvId}${nextStep ? `&next=${nextStep}` : ""}`;
    const cancelUrl = `${publicUrl}/payment-cancel.html`;
    const notifyUrl = `${publicUrl}/api/payfast/notify`;

    const paymentData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id: paymentId,
      amount: formatAmount(purchase.amountCents),
      item_name: purchase.itemName
    };

    const query = new URLSearchParams(paymentData).toString();
    const payfastUrl =
      process.env.PAYFAST_MODE === "live"
        ? "https://www.payfast.co.za/eng/process"
        : "https://sandbox.payfast.co.za/eng/process";

    res.json({
      success: true,
      redirectUrl: `${payfastUrl}?${query}`
    });
  } catch (err) {
    console.error("PAYFAST CREATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Payment creation failed"
    });
  }
});

module.exports = router;
