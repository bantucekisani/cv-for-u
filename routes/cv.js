const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const CV = require("../models/Cv");
const puppeteer = require("puppeteer");

/* ======================================================
   SAVE CV (CREATE or UPDATE)
   POST /api/cv/save
====================================================== */
router.post("/save", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    let cv;
if (body._id) {
  cv = await CV.findOne({ _id: body._id });

  if (!cv) {
    return res.status(404).json({ success: false, message: "CV not found" });
  }

  // 🔥 RECLAIM OLD CVS WITHOUT OWNER
  if (!cv.userId) {
    cv.userId = userId;
  }

  // 🔒 SECURITY: block other users
  if (cv.userId.toString() !== userId) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

} else {
  cv = new CV({ userId });
}


    /* ===== CV META (DASHBOARD NAME) ===== */
   if (typeof body.cvName === "string" && body.cvName.trim()) {
  cv.cvName = body.cvName.trim();
} else if (!cv.cvName) {
  cv.cvName = body.name?.trim() || "Untitled CV";
}


    /* ===== PERSONAL INFO ===== */
    cv.name = String(body.name || "").trim();
    cv.title = String(body.title || "").trim();
    cv.email = String(body.email || "").trim();
    cv.phone = String(body.phone || "").trim();
    cv.location = String(body.location || "").trim();
    cv.summary = String(body.summary || "").trim();
    /* ===== COVER LETTER ===== */
    cv.coverLetter = String(body.coverLetter || "").trim();

    /* ===== ARRAYS ===== */
    cv.skills = Array.isArray(body.skills) ? body.skills : [];
    cv.experience = Array.isArray(body.experience) ? body.experience : [];
    cv.education = Array.isArray(body.education) ? body.education : [];
    cv.references = Array.isArray(body.references) ? body.references : [];

    /* ===== DESIGN ===== */
    cv.template = body.template || "templateA";
    cv.color = body.color || "blue";

    /* ===== PHOTO ===== */
    cv.photo = body.photo || cv.photo || null;

    console.log("CV BEFORE SAVE:", {
      cvName: cv.cvName,
      name: cv.name,
      title: cv.title,
      email: cv.email
    });

    await cv.save();

    res.json({ success: true, cv });

  } catch (err) {
    console.error("CV SAVE ERROR:", err);
    res.status(500).json({ success: false, message: "Save failed" });
  }
});


/* ======================================================
   GET ALL CVs (Dashboard)
====================================================== */
router.get("/my-cvs", auth, async (req, res) => {
  try {
    const cvs = await CV.find({ userId: req.user.id })
      .sort({ updatedAt: -1 });

    res.json({ success: true, cvs });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


/* ======================================================
   DUPLICATE CV
====================================================== */
router.post("/duplicate/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id, userId: req.user.id });
    if (!cv) return res.status(404).json({ success: false });

    const copy = cv.toObject();
    delete copy._id;
    copy.userId = req.user.id; // 🔒 FORCE OWNER
    copy.cvName = `${cv.cvName || cv.name} (Copy)`;
    copy.updatedAt = new Date();

    const newCv = await CV.create(copy);
    res.json({ success: true, cv: newCv });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ======================================================
   RENAME CV (DASHBOARD ONLY)
====================================================== */
router.post("/rename/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { cvName: String(req.body.name || "").trim() },
      { new: true }
    );

    res.json({ success: true, cv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


/* ======================================================
   SAVE COVER LETTER ONLY (NO CV SAVE)
   POST /api/cv/:id/cover-letter
====================================================== */
router.post("/:id/cover-letter", auth, async (req, res) => {
  try {
    const { coverLetter } = req.body;

    if (!coverLetter || !coverLetter.trim()) {
      return res.status(400).json({
        success: false,
        message: "Cover letter is empty"
      });
    }

    const cv = await CV.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { coverLetter: coverLetter.trim() },
      { new: true }
    );

    if (!cv) {
      return res.status(404).json({
        success: false,
        message: "CV not found"
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("❌ COVER LETTER SAVE ERROR:", err);
    res.status(500).json({ success: false });
  }
});


/* ======================================================
   GET SINGLE CV
====================================================== */
router.get("/:id", auth, async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id });

    if (!cv) {
      return res.status(404).json({ success: false });
    }

    // 🔥 AUTO-FIX OLD CVS
    if (!cv.userId) {
      cv.userId = req.user.id;
      await cv.save();
    }

    // 🔒 SECURITY CHECK
    if (cv.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false });
    }

    res.json({ success: true, cv });
  } catch (err) {
    console.error("GET CV ERROR:", err);
    res.status(500).json({ success: false });
  }
});



/* ======================================================
   DELETE CV
====================================================== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await CV.deleteOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "CV not found"
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


module.exports = router;
