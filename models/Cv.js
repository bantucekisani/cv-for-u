const mongoose = require("mongoose");

/* ================= EXPERIENCE ================= */
const ExperienceSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  company: { type: String, default: "" },
  location: { type: String, default: "" },
  dates: { type: String, default: "" },
  bullets: { type: [String], default: [] }
});

/* ================= EDUCATION ================= */
const EducationSchema = new mongoose.Schema({
  qualification: { type: String, default: "" },
  institution: { type: String, default: "" },
  location: { type: String, default: "" },
  year: { type: String, default: "" }
});

/* ================= REFERENCES ================= */
const ReferenceSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  role: { type: String, default: "" },
  phone: { type: String, default: "" }
});

/* ================= CV ================= */
const CVSchema = new mongoose.Schema(
  {
    /* ===== OWNER ===== */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
   required: false,
      index: true
    },

    /* ===== CV META (DASHBOARD NAME) ===== */
    cvName: { type: String, default: "Untitled CV" },

    /* ===== PERSONAL INFO ===== */
    name: { type: String, default: "" },
    title: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    summary: { type: String, default: "" },

    /* ===== COVER LETTER ===== */
    coverLetter: { type: String, default: "" },

    /* ===== SKILLS ===== */
    skills: { type: [String], default: [] },

    /* ===== EXPERIENCE & EDUCATION ===== */
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },

    /* ===== REFERENCES ===== */
    references: { type: [ReferenceSchema], default: [] },

    /* ===== TEMPLATE & DESIGN ===== */
    template: { type: String, default: "templateA" },
    color: { type: String, default: "blue" },

    /* ===== PHOTO ===== */
    photo: { type: String, default: null },

   /* ===== PAYMENT FLAGS ===== */
isPaid: { type: Boolean, default: false },

/* ===== DOWNLOAD CREDITS ===== */
downloadsRemaining: { type: Number, default: 0 },
coverLettersRemaining: { type: Number, default: 0 },

/* ===== PAYFAST SAFETY ===== */
lastPaymentId: { type: String, default: null }

  },
  {
    timestamps: true,
    strict: true
  }
);

module.exports = mongoose.model("CV", CVSchema);
