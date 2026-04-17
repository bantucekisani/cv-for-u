const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;
let smtpTransporter = null;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function slugifyUsername(value) {
  const username = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-._]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");

  return username.length >= 3 ? username.slice(0, 30) : "";
}

function validatePassword(password) {
  const value = String(password || "");

  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (value.length > 72) {
    return "Password is too long";
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Password must include at least one letter and one number";
  }

  return null;
}

function buildUserPayload(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    username: user.username || null,
    email: user.email,
    role: user.role,
    plan: user.plan
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function hashResetToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function clearPasswordResetState(user) {
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  return user.save();
}

function buildPasswordResetEmailText(user, resetUrl) {
  return [
    `Hello ${user.fullName || "there"},`,
    "",
    "We received a request to reset your CV for U password.",
    "Use the button in the email or open this link:",
    `Reset your password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you did not request this, you can ignore this email."
  ].join("\n");
}

function getAppUrl(req) {
  return (
    process.env.FRONTEND_URL ||
    process.env.WEB_URL ||
    process.env.APP_URL ||
    process.env.PUBLIC_URL ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/+$/, "");
}

function buildPasswordResetEmailHtml(user, resetUrl) {
  const name = escapeHtml(user.fullName || "there");
  const safeUrl = escapeHtml(resetUrl);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <p>Hello ${name},</p>
      <p>We received a request to reset your CV for U password.</p>
      <p>
        <a
          href="${safeUrl}"
          style="display:inline-block;padding:12px 20px;border-radius:8px;background:#144f9b;color:#ffffff;text-decoration:none;font-weight:600;"
        >
          Reset your password
        </a>
      </p>
      <p>If the button does not open, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;">
        <a href="${safeUrl}" style="color:#144f9b;">${safeUrl}</a>
      </p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

function getSmtpConfig() {
  const user = String(process.env.EMAIL_USER || "").trim();
  const host = String(
    process.env.EMAIL_HOST ||
    (/@gmail\.com$/i.test(user) ? "smtp.gmail.com" : "")
  ).trim();
  const portValue = String(process.env.EMAIL_PORT || "").trim();
  const pass = String(process.env.EMAIL_PASS || "").trim();
  const from = String(
    process.env.EMAIL_FROM || process.env.RESEND_FROM || user || ""
  ).trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || "").trim();
  const secure = parseBooleanEnv(process.env.EMAIL_SECURE, portValue === "465");
  const defaultPort = host ? (secure ? 465 : 587) : 0;
  const port = Number.parseInt(portValue || String(defaultPort), 10);

  if (!host || !user || !pass || !from || Number.isNaN(port)) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    replyTo,
    secure
  };
}

function getPasswordResetEmailDiagnostics() {
  const smtpConfig = getSmtpConfig();
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const resendFrom = String(
    process.env.EMAIL_FROM || process.env.RESEND_FROM || ""
  ).trim();

  return {
    smtpConfigured: Boolean(smtpConfig),
    resendConfigured: Boolean(resendApiKey && resendFrom),
    hasEmailHost: Boolean(String(process.env.EMAIL_HOST || "").trim()),
    hasEmailPort: Boolean(String(process.env.EMAIL_PORT || "").trim()),
    hasEmailUser: Boolean(String(process.env.EMAIL_USER || "").trim()),
    hasEmailPass: Boolean(String(process.env.EMAIL_PASS || "").trim()),
    hasEmailFrom: Boolean(String(process.env.EMAIL_FROM || "").trim()),
    hasResendApiKey: Boolean(resendApiKey),
    hasResendFrom: Boolean(String(process.env.RESEND_FROM || "").trim())
  };
}

function getSmtpTransporter(config) {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  return smtpTransporter;
}

async function findUserByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    return null;
  }

  return User.findOne({
    $or: [
      { email: normalized },
      { username: normalized }
    ]
  });
}

async function generateUniqueUsername(baseValue, excludeUserId = null) {
  const seed =
    slugifyUsername(baseValue) ||
    `user${Date.now().toString().slice(-6)}`;

  let candidate = seed.slice(0, 30);
  let counter = 0;

  while (true) {
    const query = { username: candidate };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const exists = await User.exists(query);
    if (!exists) {
      return candidate;
    }

    counter += 1;
    const suffix = `${counter}`;
    const prefix = seed.slice(0, Math.max(3, 30 - suffix.length));
    candidate = `${prefix}${suffix}`;
  }
}

async function ensureUsername(user, preferredValue = "") {
  if (user.username) {
    return user.username;
  }

  user.username = await generateUniqueUsername(
    preferredValue || user.fullName || user.email.split("@")[0],
    user._id
  );

  await user.save();
  return user.username;
}

async function sendPasswordResetEmailViaSmtp(user, resetUrl) {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    return false;
  }

  const transporter = getSmtpTransporter(smtpConfig);
  await transporter.sendMail({
    from: smtpConfig.from,
    to: user.email,
    replyTo: smtpConfig.replyTo || undefined,
    subject: "Reset your CV for U password",
    html: buildPasswordResetEmailHtml(user, resetUrl),
    text: buildPasswordResetEmailText(user, resetUrl)
  });

  return true;
}

async function sendPasswordResetEmailViaResend(user, resetUrl) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!resendApiKey || !emailFrom) {
    console.warn("Password reset email not sent: missing email config", {
      hasResendApiKey: Boolean(resendApiKey),
      hasEmailFrom: Boolean(emailFrom)
    });
    return false;
  }

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: emailFrom,
      to: [user.email],
      subject: "Reset your CV for U password",
      reply_to: replyTo || undefined,
      html: buildPasswordResetEmailHtml(user, resetUrl),
      text: buildPasswordResetEmailText(user, resetUrl)
    },
    {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return true;
}

async function sendPasswordResetEmail(user, resetUrl) {
  try {
    const sentViaSmtp = await sendPasswordResetEmailViaSmtp(user, resetUrl);
    if (sentViaSmtp) {
      return true;
    }
  } catch (err) {
    console.error("PASSWORD RESET SMTP ERROR:", err.message);
  }

  return sendPasswordResetEmailViaResend(user, resetUrl);
}

/* ============================
   SIGNUP
============================ */
router.post("/signup", async (req, res) => {
  try {
    let { fullName, email, password, confirmPassword } = req.body;
    const rawUsername = String(req.body.username || "").trim();

    fullName = String(fullName || "").trim();
    email = normalizeEmail(email);
    let username = slugifyUsername(rawUsername);

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required"
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    if (rawUsername && !username) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters and use letters, numbers, dots, dashes, or underscores"
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: "Username already taken"
        });
      }
    } else {
      username = await generateUniqueUsername(fullName || email.split("@")[0]);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName,
      username,
      email,
      password: hashedPassword,
      role: "user",
      plan: "free"
    });

    res.status(201).json({
      success: true,
      user: buildUserPayload(user),
      token: signToken(user)
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ============================
   LOGIN
============================ */
router.post("/login", async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier || req.body.email);
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(401).json({
        success: false,
        message: "Invalid login details"
      });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid login details"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login details"
      });
    }

    await ensureUsername(user, user.fullName || user.email.split("@")[0]);

    res.json({
      success: true,
      user: buildUserPayload(user),
      token: signToken(user)
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ============================
   CURRENT USER
============================ */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await ensureUsername(user, user.fullName || user.email.split("@")[0]);

    res.json({
      success: true,
      user: buildUserPayload(user)
    });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ============================
   FORGOT PASSWORD
============================ */
router.post("/forgot-password", async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier || req.body.email);

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Email or username is required"
      });
    }

    const emailDiagnostics = getPasswordResetEmailDiagnostics();
    if (!emailDiagnostics.smtpConfigured && !emailDiagnostics.resendConfigured) {
      console.error("PASSWORD RESET EMAIL NOT CONFIGURED:", emailDiagnostics);
      return res.status(503).json({
        success: false,
        message: "Password reset email is not configured right now. Please contact support."
      });
    }

    const user = await findUserByIdentifier(identifier);

    const response = {
      success: true,
      message: "If an account exists, a reset link has been sent."
    };

    if (!user) {
      return res.json(response);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const resetUrl = `${getAppUrl(req)}/reset-password.html?token=${rawToken}`;

    user.passwordResetTokenHash = hashResetToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    let delivered = false;
    try {
      delivered = await sendPasswordResetEmail(user, resetUrl);
    } catch (err) {
      console.error(
        "PASSWORD RESET EMAIL ERROR:",
        err.response?.data || err.message
      );
    }

    if (!delivered) {
      await clearPasswordResetState(user);

      const failureResponse = {
        success: false,
        message: "We could not send the reset email right now. Please try again later."
      };

      if (
        process.env.NODE_ENV !== "production" ||
        process.env.EXPOSE_PASSWORD_RESET_LINKS === "true"
      ) {
        failureResponse.resetUrl = resetUrl;
      }

      return res.status(503).json(failureResponse);
    }

    res.json(response);
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ============================
   VALIDATE RESET TOKEN
============================ */
router.get("/reset-password/validate", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required"
      });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired"
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("RESET TOKEN VALIDATION ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ============================
   RESET PASSWORD
============================ */
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Reset token and password are required"
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired"
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await ensureUsername(user, user.fullName || user.email.split("@")[0]);
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
      user: buildUserPayload(user),
      token: signToken(user)
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
