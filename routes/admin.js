const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const User = require("../models/User");
const CV = require("../models/Cv");
const Payment = require("../models/Payment");

/* ================= ADMIN STATS ================= */
router.get("/stats", auth, admin, async (req, res) => {
  try {
    const users = await User.countDocuments();
    const cvs = await CV.countDocuments();
    const paidCVs = await CV.countDocuments({ isPaid: true });

    const payments = await Payment.find(
      { status: "COMPLETE" },
      { amount: 1 }
    ).lean();

    const revenue = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    res.json({
      success: true,
      stats: { users, cvs, paidCVs, revenue }
    });
  } catch (err) {
    console.error("❌ ADMIN STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= PAYMENTS ================= */
router.get("/payments", auth, admin, async (req, res) => {
  try {
    const payments = await Payment.find({ status: "COMPLETE" })
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, payments });
  } catch (err) {
    console.error("❌ ADMIN PAYMENTS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= REVENUE ================= */
router.get("/revenue", auth, admin, async (req, res) => {
  try {
    const payments = await Payment.find({ status: "COMPLETE" }).lean();

    const daily = {};
    const monthly = {};

    payments.forEach(p => {
      if (!p.createdAt) return;
      const amount = Number(p.amount || 0);

      const day = p.createdAt.toISOString().slice(0, 10);
      const month = p.createdAt.toISOString().slice(0, 7);

      daily[day] = (daily[day] || 0) + amount;
      monthly[month] = (monthly[month] || 0) + amount;
    });

    res.json({ success: true, daily, monthly });
  } catch (err) {
    console.error("❌ ADMIN REVENUE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= USERS ================= */
router.get("/users", auth, admin, async (req, res) => {
  try {
    const users = await User.find()
      .select("fullName email role createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const normalised = users.map(u => ({
      ...u,
      role: u.role || "user"   // ✅ FIX
    }));

    res.json({ success: true, users: normalised });
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ success: false });
  }
});


module.exports = router;
