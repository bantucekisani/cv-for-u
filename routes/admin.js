const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const User = require("../models/User");
const CV = require("../models/Cv");
const Payment = require("../models/Payment");

const PAYMENT_TYPES = ["cv", "cover-letter"];
const MAX_PAYMENT_LIMIT = 250;

function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value) {
  return Number(toAmount(value).toFixed(2));
}

function sumAmounts(items = []) {
  return roundCurrency(items.reduce((sum, item) => sum + toAmount(item.amount), 0));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    1
  ));
}

function shiftUtcDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function shiftUtcMonths(date, amount) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + amount,
    1
  ));
}

function formatDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatMonthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPaymentMatch(query = {}) {
  const match = { status: "COMPLETE" };
  const type = PAYMENT_TYPES.includes(query.type) ? query.type : null;
  const from = parseDateStart(query.from);
  const to = parseDateEnd(query.to);

  if (type) {
    match.type = type;
  }

  if (from || to) {
    match.createdAt = {};

    if (from) {
      match.createdAt.$gte = from;
    }

    if (to) {
      match.createdAt.$lte = to;
    }
  }

  return {
    match,
    filters: {
      type: type || "all",
      from: query.from || "",
      to: query.to || ""
    }
  };
}

function buildDailyRevenueSeries(payments = [], days = 14) {
  const totals = new Map();

  payments.forEach(payment => {
    if (!payment.createdAt) return;
    const key = formatDayKey(payment.createdAt);
    totals.set(key, roundCurrency((totals.get(key) || 0) + toAmount(payment.amount)));
  });

  const today = startOfUtcDay(new Date());
  const firstDay = shiftUtcDays(today, -(days - 1));
  const series = [];

  for (let cursor = new Date(firstDay); cursor <= today; cursor = shiftUtcDays(cursor, 1)) {
    const key = formatDayKey(cursor);
    series.push({
      label: key,
      amount: roundCurrency(totals.get(key) || 0)
    });
  }

  return series;
}

function buildMonthlyAmountSeries(records = [], months = 6) {
  const totals = new Map();

  records.forEach(record => {
    if (!record.createdAt) return;
    const key = formatMonthKey(record.createdAt);
    totals.set(key, roundCurrency((totals.get(key) || 0) + toAmount(record.amount)));
  });

  const currentMonth = startOfUtcMonth(new Date());
  const firstMonth = shiftUtcMonths(currentMonth, -(months - 1));
  const series = [];

  for (let index = 0; index < months; index += 1) {
    const date = shiftUtcMonths(firstMonth, index);
    const key = formatMonthKey(date);
    series.push({
      label: key,
      amount: roundCurrency(totals.get(key) || 0)
    });
  }

  return series;
}

function buildMonthlyCountSeries(records = [], months = 6) {
  const totals = new Map();

  records.forEach(record => {
    if (!record.createdAt) return;
    const key = formatMonthKey(record.createdAt);
    totals.set(key, (totals.get(key) || 0) + 1);
  });

  const currentMonth = startOfUtcMonth(new Date());
  const firstMonth = shiftUtcMonths(currentMonth, -(months - 1));
  const series = [];

  for (let index = 0; index < months; index += 1) {
    const date = shiftUtcMonths(firstMonth, index);
    const key = formatMonthKey(date);
    series.push({
      label: key,
      count: totals.get(key) || 0
    });
  }

  return series;
}

function buildPaymentTypeSummary(payments = []) {
  return PAYMENT_TYPES.map(type => {
    const matching = payments.filter(payment => payment.type === type);

    return {
      type,
      label: type === "cover-letter" ? "Cover Letters" : "CVs",
      count: matching.length,
      amount: sumAmounts(matching)
    };
  });
}

function buildPaymentSummary(payments = []) {
  const revenue = sumAmounts(payments);
  const paymentTypes = buildPaymentTypeSummary(payments);
  const cvSummary = paymentTypes.find(item => item.type === "cv");
  const coverLetterSummary = paymentTypes.find(item => item.type === "cover-letter");

  return {
    count: payments.length,
    revenue,
    averageOrderValue: payments.length ? roundCurrency(revenue / payments.length) : 0,
    cvCount: cvSummary?.count || 0,
    coverLetterCount: coverLetterSummary?.count || 0
  };
}

function normaliseUser(user) {
  return {
    ...user,
    role: user.role || "user"
  };
}

function safeIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

/* ================= ADMIN OVERVIEW ================= */
router.get("/overview", auth, admin, async (req, res) => {
  try {
    const todayStart = startOfUtcDay(new Date());
    const monthStart = startOfUtcMonth(new Date());

    const [
      totalUsers,
      totalCVs,
      paidCVs,
      userDates,
      recentUsers,
      payments
    ] = await Promise.all([
      User.countDocuments(),
      CV.countDocuments(),
      CV.countDocuments({ isPaid: true }),
      User.find({}, { createdAt: 1 }).lean(),
      User.find()
        .select("fullName email role createdAt")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Payment.find({ status: "COMPLETE" }, { amount: 1, type: 1, createdAt: 1 }).lean()
    ]);

    const revenue = sumAmounts(payments);
    const revenueToday = sumAmounts(
      payments.filter(payment => payment.createdAt && payment.createdAt >= todayStart)
    );
    const revenueThisMonth = sumAmounts(
      payments.filter(payment => payment.createdAt && payment.createdAt >= monthStart)
    );
    const paymentsToday = payments.filter(
      payment => payment.createdAt && payment.createdAt >= todayStart
    ).length;
    const paymentsThisMonth = payments.filter(
      payment => payment.createdAt && payment.createdAt >= monthStart
    ).length;
    const usersThisMonth = userDates.filter(
      user => user.createdAt && user.createdAt >= monthStart
    ).length;

    res.json({
      success: true,
      overview: {
        metrics: {
          users: totalUsers,
          cvs: totalCVs,
          paidCVs,
          revenue,
          revenueToday,
          revenueThisMonth,
          paymentsToday,
          paymentsThisMonth,
          averageOrderValue: payments.length ? roundCurrency(revenue / payments.length) : 0,
          usersThisMonth
        },
        trends: {
          revenueByDay: buildDailyRevenueSeries(payments, 14),
          revenueByMonth: buildMonthlyAmountSeries(payments, 6),
          usersByMonth: buildMonthlyCountSeries(userDates, 6)
        },
        paymentTypes: buildPaymentTypeSummary(payments),
        recentUsers: recentUsers.map(normaliseUser)
      }
    });
  } catch (err) {
    console.error("ADMIN OVERVIEW ERROR:", err);
    res.status(500).json({ success: false });
  }
});

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

    const revenue = sumAmounts(payments);

    res.json({
      success: true,
      stats: { users, cvs, paidCVs, revenue }
    });
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= EXPORT PAYMENTS CSV ================= */
router.get("/payments/export", auth, admin, async (req, res) => {
  try {
    const { match } = buildPaymentMatch(req.query);

    const payments = await Payment.find(match)
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    const rows = [
      [
        "Date",
        "Type",
        "Amount",
        "Provider",
        "Status",
        "Payment ID",
        "User Name",
        "User Email"
      ],
      ...payments.map(payment => ([
        safeIso(payment.createdAt),
        payment.type || "",
        toAmount(payment.amount).toFixed(2),
        payment.provider || "",
        payment.status || "",
        payment.paymentId || "",
        payment.userId?.fullName || "",
        payment.userId?.email || ""
      ]))
    ];

    const csv = `\uFEFF${rows
      .map(columns => columns.map(escapeCsvValue).join(","))
      .join("\n")}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"admin-payments.csv\"");
    res.send(csv);
  } catch (err) {
    console.error("ADMIN PAYMENTS EXPORT ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= PAYMENTS ================= */
router.get("/payments", auth, admin, async (req, res) => {
  try {
    const { match, filters } = buildPaymentMatch(req.query);
    const limit = clamp(parseInt(req.query.limit, 10) || 50, 1, MAX_PAYMENT_LIMIT);

    const [allMatchingPayments, payments] = await Promise.all([
      Payment.find(match, { amount: 1, type: 1, createdAt: 1 }).lean(),
      Payment.find(match)
        .populate("userId", "fullName email")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      filters: {
        ...filters,
        limit
      },
      summary: buildPaymentSummary(allMatchingPayments),
      payments
    });
  } catch (err) {
    console.error("ADMIN PAYMENTS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= REVENUE ================= */
router.get("/revenue", auth, admin, async (req, res) => {
  try {
    const payments = await Payment.find({ status: "COMPLETE" }).lean();

    const daily = {};
    const monthly = {};

    payments.forEach(payment => {
      if (!payment.createdAt) return;
      const amount = toAmount(payment.amount);

      const day = formatDayKey(payment.createdAt);
      const month = formatMonthKey(payment.createdAt);

      daily[day] = roundCurrency((daily[day] || 0) + amount);
      monthly[month] = roundCurrency((monthly[month] || 0) + amount);
    });

    res.json({ success: true, daily, monthly });
  } catch (err) {
    console.error("ADMIN REVENUE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= USERS ================= */
router.get("/users", auth, admin, async (req, res) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);

    const users = await User.find()
      .select("fullName email role createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      users: users.map(normaliseUser)
    });
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
