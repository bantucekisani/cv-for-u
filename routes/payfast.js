const express = require("express");
const rateLimit = require("express-rate-limit");

const auth = require("../middleware/auth");
const CV = require("../models/Cv");
const User = require("../models/User");
const {
  getPurchaseConfig,
  formatAmount
} = require("../utils/paymentPlans");
const {
  assertConfigured,
  buildPaymentData,
  buildRedirectQuery,
  getProcessUrl
} = require("../utils/payfastConfig");

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

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function splitFullName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
}

/* ======================================================
   PAYFAST CREATE PAYMENT
   POST /api/payfast/create
====================================================== */
router.post("/create", auth, createPaymentLimiter, async (req, res) => {
  try {
    assertConfigured();

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
    const publicUrl = normalizeUrl(
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      "https://cv-for-u.onrender.com"
    );

    const buyer = await User.findById(req.user.id).select("fullName email");
    const { firstName, lastName } = splitFullName(buyer?.fullName);

    const paymentId = `${purchase.type}-${cvId}-${req.user.id}-${Date.now()}`;
    const returnUrl = `${publicUrl}/payment-success.html?type=${purchase.type}&cv=${cvId}${nextStep ? `&next=${nextStep}` : ""}`;
    const cancelUrl = `${publicUrl}/payment-cancel.html`;
    const notifyUrl = `${publicUrl}/api/payfast/notify`;

    const paymentData = buildPaymentData({
      paymentId,
      amount: formatAmount(purchase.amountCents),
      itemName: purchase.itemName,
      returnUrl,
      cancelUrl,
      notifyUrl,
      emailAddress: buyer?.email,
      firstName,
      lastName
    });

    const query = buildRedirectQuery(paymentData);

    res.json({
      success: true,
      redirectUrl: `${getProcessUrl()}?${query}`
    });
  } catch (err) {
    console.error("PAYFAST CREATE ERROR:", err);

    if (err.message === "PayFast merchant credentials are not configured") {
      return res.status(503).json({
        success: false,
        message: "Payment gateway is not configured yet"
      });
    }

    res.status(500).json({
      success: false,
      message: "Payment creation failed"
    });
  }
});

module.exports = router;
