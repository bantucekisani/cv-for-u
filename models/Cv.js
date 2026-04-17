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
  company: { type: String, default: "" },
  phone: { type: String, default: "" }
});

/* ================= JOB MATCHES ================= */
const JobMatchSchema = new mongoose.Schema({
  platform: { type: String, default: "" },
  jobTitle: { type: String, default: "" },
  jobUrl: { type: String, default: "" },
  jobTextSnippet: { type: String, default: "" },
  matchScore: { type: Number, default: 0 },
  verdict: { type: String, default: "" },
  strengths: { type: [String], default: [] },
  gaps: { type: [String], default: [] },
  missingRequirements: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },
  atsKeywords: { type: [String], default: [] },
  tailoredSummary: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

/* ================= JOB SEARCHES ================= */
const JobSearchTargetSchema = new mongoose.Schema({
  roleTitle: { type: String, default: "" },
  searchQuery: { type: String, default: "" },
  location: { type: String, default: "" },
  matchScore: { type: Number, default: 0 },
  whyFit: { type: String, default: "" },
  keywords: { type: [String], default: [] },
  indeedUrl: { type: String, default: "" },
  linkedinUrl: { type: String, default: "" },
  pnetUrl: { type: String, default: "" },
  careers24Url: { type: String, default: "" },
  jobmailUrl: { type: String, default: "" }
});

const JobSearchSchema = new mongoose.Schema({
  locationFocus: { type: String, default: "" },
  profileSummary: { type: String, default: "" },
  searchTips: { type: [String], default: [] },
  targetRoles: { type: [JobSearchTargetSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
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
    referencesOnRequest: { type: Boolean, default: false },

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
lastPaymentId: { type: String, default: null },

/* ===== JOB MATCH HISTORY ===== */
jobMatches: { type: [JobMatchSchema], default: [] },

/* ===== JOB FINDER HISTORY ===== */
jobSearches: { type: [JobSearchSchema], default: [] }

  },
  {
    timestamps: true,
    strict: true
  }
);

module.exports = mongoose.model("CV", CVSchema);
