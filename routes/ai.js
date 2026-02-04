const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const OpenAI = require("openai");

/* ===============================
   OPENAI SETUP
================================ */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Stable + cheap (2025)
const MODEL = "gpt-4o"; // ✅ BEST QUALITY (paid users)


/* ===============================
   SAFE JSON PARSER
================================ */
/* ===============================
   SAFE JSON PARSER (PRODUCTION)
================================ */
function safeJsonParse(text) {
  try {
    // First attempt: pure JSON
    return JSON.parse(text);
  } catch {
    try {
      // Fallback: extract JSON block if AI adds extra text
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch {
      return null;
    }
  }
}


/* =====================================================
   AI – QUICK CV BUILD
   POST /api/ai/quick-build
===================================================== */
router.post("/quick-build", auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt)
      return res.json({ success: false, msg: "Missing prompt" });

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: "Return STRICT JSON only. No text." },
        {
          role: "user",
          content: `
Create a professional CV from this text:

"${prompt}"

Return JSON ONLY:
{
  "name": "",
  "title": "",
  "summary": "",
  "skills": [],
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": []
}
`
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const cv = safeJsonParse(raw);

    if (!cv) {
      console.error("AI RAW:", raw);
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, cv });

  } catch (err) {
    console.error("AI QUICK ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI – FULL CV
   POST /api/ai/full-cv
===================================================== */
router.post("/full-cv", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text)
      return res.json({ success: false, msg: "Missing text" });

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: "Return STRICT JSON only." },
        {
          role: "user",
          content: `
Create a FULL ATS-OPTIMIZED CV from:

"${text}"

Return JSON ONLY:
{
  "title": "",
  "summary": "",
  "skills": [],
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "qualification": "",
      "institution": "",
      "location": "",
      "year": ""
    }
  ]
}
`
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const cv = safeJsonParse(raw);

    if (!cv) {
      console.error("AI RAW:", raw);
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, cv });

  } catch (err) {
    console.error("AI FULL ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI – COVER LETTER
   POST /api/ai/cover-letter
===================================================== */
router.post("/cover-letter", auth, async (req, res) => {
  try {
    const { text, name, title } = req.body;

    if (!text)
      return res.json({ success: false, msg: "Missing job description" });

    const prompt = `
Write a professional cover letter.

Candidate:
Name: ${name || "Candidate"}
Title: ${title || "Job Seeker"}

Job Description:
"${text}"

Rules:
- South African professional tone
- 3–4 paragraphs
- ATS optimized
- Plain text only
`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        { role: "system", content: "You write professional cover letters." },
        { role: "user", content: prompt }
      ]
    });

    res.json({
      success: true,
      letter: completion.choices[0].message.content.trim()
    });

  } catch (err) {
    console.error("COVER LETTER ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});
router.post("/suggest-skills", auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title)
      return res.json({ success: false, msg: "Missing title" });

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: "Return STRICT JSON only." },
        {
          role: "user",
          content: `
Suggest 8–12 professional skills for this job title:

"${title}"

Return JSON ONLY:
{
  "skills": []
}
`
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const data = safeJsonParse(raw);

    if (!data?.skills) {
      console.error("AI RAW:", raw);
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, skills: data.skills });

  } catch (err) {
    console.error("AI SKILLS ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});
router.post("/suggest-summary", auth, async (req, res) => {
  try {
    const { title, summary } = req.body;

    if (!title)
      return res.json({ success: false, msg: "Missing title" });

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: "Return STRICT JSON only." },
        {
          role: "user",
          content: `
Improve this professional summary for the job title "${title}".

Current summary:
"${summary || ""}"

Return JSON ONLY:
{
  "summary": ""
}
`
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const data = safeJsonParse(raw);

    if (!data?.summary) {
      console.error("AI RAW:", raw);
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, summary: data.summary });

  } catch (err) {
    console.error("AI SUMMARY ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

module.exports = router;
