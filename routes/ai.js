const express = require("express");
const OpenAI = require("openai");

const auth = require("../middleware/auth");
const CV = require("../models/Cv");

const router = express.Router();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = "gpt-4o";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch {
      return null;
    }
  }
}

function cleanText(value, maxLength = 4000) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeStringArray(values, { maxItems = 12, maxLength = 80 } = {}) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(
    values
      .map(value => cleanText(value, maxLength))
      .filter(Boolean)
  )].slice(0, maxItems);
}

function normalizeExperience(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(item => ({
      title: cleanText(item?.title, 120),
      company: cleanText(item?.company, 120),
      location: cleanText(item?.location, 120),
      dates: cleanText(item?.dates, 120),
      bullets: normalizeStringArray(item?.bullets, {
        maxItems: 6,
        maxLength: 180
      })
    }))
    .filter(item =>
      item.title ||
      item.company ||
      item.location ||
      item.dates ||
      item.bullets.length
    )
    .slice(0, 6);
}

function normalizeEducation(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(item => ({
      qualification: cleanText(item?.qualification, 140),
      institution: cleanText(item?.institution, 140),
      location: cleanText(item?.location, 120),
      year: cleanText(item?.year, 40)
    }))
    .filter(item =>
      item.qualification ||
      item.institution ||
      item.location ||
      item.year
    )
    .slice(0, 4);
}

function normalizeCvPayload(cv = {}) {
  return {
    name: cleanText(cv.name, 120),
    title: cleanText(cv.title, 120),
    email: cleanText(cv.email, 160),
    phone: cleanText(cv.phone, 80),
    location: cleanText(cv.location, 120),
    summary: cleanText(cv.summary, 700),
    skills: normalizeStringArray(cv.skills, {
      maxItems: 12,
      maxLength: 60
    }),
    experience: normalizeExperience(cv.experience),
    education: normalizeEducation(cv.education)
  };
}

function clampScore(value) {
  const score = Number.parseInt(value, 10);

  if (Number.isNaN(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeJobMatchPayload(match = {}) {
  return {
    matchScore: clampScore(match.matchScore),
    verdict: cleanText(match.verdict, 180),
    strengths: normalizeStringArray(match.strengths, {
      maxItems: 6,
      maxLength: 140
    }),
    gaps: normalizeStringArray(match.gaps, {
      maxItems: 6,
      maxLength: 140
    }),
    missingRequirements: normalizeStringArray(match.missingRequirements, {
      maxItems: 6,
      maxLength: 140
    }),
    recommendations: normalizeStringArray(match.recommendations, {
      maxItems: 6,
      maxLength: 160
    }),
    atsKeywords: normalizeStringArray(match.atsKeywords, {
      maxItems: 12,
      maxLength: 60
    }),
    tailoredSummary: cleanText(match.tailoredSummary, 500)
  };
}

function buildMatchVerdict(score) {
  if (score >= 85) {
    return "Strong match";
  }

  if (score >= 70) {
    return "Good match";
  }

  if (score >= 50) {
    return "Possible match with improvements";
  }

  return "Low match right now";
}

function buildJobMatchHistoryEntry({
  platform,
  jobTitle,
  jobUrl,
  jobText,
  match
}) {
  return {
    platform: cleanText(platform, 60),
    jobTitle: cleanText(jobTitle, 160),
    jobUrl: cleanText(jobUrl, 500),
    jobTextSnippet: cleanText(jobText, 280),
    matchScore: clampScore(match.matchScore),
    verdict: cleanText(match.verdict, 180),
    strengths: normalizeStringArray(match.strengths, {
      maxItems: 6,
      maxLength: 140
    }),
    gaps: normalizeStringArray(match.gaps, {
      maxItems: 6,
      maxLength: 140
    }),
    missingRequirements: normalizeStringArray(match.missingRequirements, {
      maxItems: 6,
      maxLength: 140
    }),
    recommendations: normalizeStringArray(match.recommendations, {
      maxItems: 6,
      maxLength: 160
    }),
    atsKeywords: normalizeStringArray(match.atsKeywords, {
      maxItems: 12,
      maxLength: 60
    }),
    tailoredSummary: cleanText(match.tailoredSummary, 500),
    createdAt: new Date()
  };
}

function buildIndeedSearchUrl(query, location) {
  const url = new URL("https://za.indeed.com/jobs");
  url.searchParams.set("q", cleanText(query, 160));

  if (location) {
    url.searchParams.set("l", cleanText(location, 120));
  }

  return url.toString();
}

function buildLinkedInSearchUrl(query, location) {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  url.searchParams.set("keywords", cleanText(query, 160));
  url.searchParams.set("location", cleanText(location || "South Africa", 120));
  return url.toString();
}

function buildGoogleSiteJobUrl(domain, query, location) {
  const searchTerms = [
    `site:${domain}`,
    cleanText(query, 160),
    cleanText(location, 120),
    "jobs",
    "South Africa"
  ].filter(Boolean).join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`;
}

function normalizeJobFinderPayload(plan = {}) {
  const targetRoles = Array.isArray(plan.targetRoles)
    ? plan.targetRoles
      .map(role => ({
        roleTitle: cleanText(role?.roleTitle, 120),
        searchQuery: cleanText(role?.searchQuery || role?.roleTitle, 160),
        location: cleanText(role?.location, 120),
        matchScore: clampScore(role?.matchScore),
        whyFit: cleanText(role?.whyFit, 260),
        keywords: normalizeStringArray(role?.keywords, {
          maxItems: 8,
          maxLength: 60
        })
      }))
      .filter(role => role.roleTitle || role.searchQuery)
      .slice(0, 5)
    : [];

  return {
    locationFocus: cleanText(plan.locationFocus, 120) || "South Africa",
    profileSummary: cleanText(plan.profileSummary, 400),
    searchTips: normalizeStringArray(plan.searchTips, {
      maxItems: 6,
      maxLength: 140
    }),
    targetRoles
  };
}

function attachJobBoardLinks(target = {}, { locationFocus = "", includeRemote = false } = {}) {
  const baseQuery = cleanText(target.searchQuery || target.roleTitle, 160);
  const searchQuery = includeRemote && !/\bremote\b/i.test(baseQuery)
    ? `${baseQuery} remote`
    : baseQuery;
  const location = cleanText(target.location || locationFocus || "South Africa", 120);

  return {
    ...target,
    searchQuery,
    location,
    indeedUrl: buildIndeedSearchUrl(searchQuery, location),
    linkedinUrl: buildLinkedInSearchUrl(searchQuery, location),
    pnetUrl: buildGoogleSiteJobUrl("pnet.co.za", searchQuery, location),
    careers24Url: buildGoogleSiteJobUrl("careers24.com", searchQuery, location),
    jobmailUrl: buildGoogleSiteJobUrl("jobmail.co.za", searchQuery, location)
  };
}

function buildJobSearchHistoryEntry(plan = {}, { preferredLocation = "", includeRemote = false } = {}) {
  const locationFocus = cleanText(preferredLocation || plan.locationFocus, 120) || "South Africa";

  return {
    locationFocus,
    profileSummary: cleanText(plan.profileSummary, 400),
    searchTips: normalizeStringArray(plan.searchTips, {
      maxItems: 6,
      maxLength: 140
    }),
    targetRoles: (Array.isArray(plan.targetRoles) ? plan.targetRoles : [])
      .map(target => attachJobBoardLinks(target, { locationFocus, includeRemote }))
      .slice(0, 5),
    createdAt: new Date()
  };
}

async function createJsonCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.4
}) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || "";
  const data = safeJsonParse(raw);

  if (!data) {
    console.error("AI RAW:", raw);
    throw new Error("Invalid AI JSON");
  }

  return data;
}

async function createTextCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.5
}) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return cleanText(completion.choices?.[0]?.message?.content || "", 8000);
}

/* =====================================================
   AI - QUICK CV BUILD
===================================================== */
router.post("/quick-build", auth, async (req, res) => {
  try {
    const prompt = cleanText(req.body.prompt, 4000);

    if (!prompt) {
      return res.json({ success: false, msg: "Missing prompt" });
    }

    const rawCv = await createJsonCompletion({
      systemPrompt:
        "You are CV for U's AI CV assistant. Turn rough candidate notes into a truthful, professional CV draft. Never invent employers, dates, degrees, contact details, or achievements that are not supported by the user's notes. If a detail is missing, leave it blank. Return strict JSON only.",
      userPrompt: `
Build a polished first CV draft from these notes:

"${prompt}"

Rules:
- Write a concise ATS-friendly summary in 2-4 sentences.
- Suggest 6-12 relevant skills.
- Convert work history into strong bullet points with action verbs.
- Use plain professional language suitable for South African job seekers.
- Keep bullet points factual and do not guess numbers or dates.

Return JSON only:
{
  "name": "",
  "title": "",
  "email": "",
  "phone": "",
  "location": "",
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
    });

    res.json({
      success: true,
      cv: normalizeCvPayload(rawCv)
    });
  } catch (err) {
    console.error("AI QUICK ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - FULL CV
===================================================== */
router.post("/full-cv", auth, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 6000);

    if (!text) {
      return res.json({ success: false, msg: "Missing text" });
    }

    const rawCv = await createJsonCompletion({
      systemPrompt:
        "You are CV for U's senior CV assistant. Transform long-form candidate information into a complete ATS-ready CV draft. Keep everything truthful, professional, and realistic. Never fabricate facts. Return strict JSON only.",
      userPrompt: `
Create a detailed CV draft from the candidate information below:

"${text}"

Instructions:
- Extract any available name, title, email, phone, and location.
- Write a sharp professional summary focused on strengths, experience, and employability.
- Suggest 8-12 role-relevant skills when the notes clearly support them.
- For each experience entry, write up to 5 concise bullet points.
- Preserve the user's real facts and avoid adding fake metrics, companies, or dates.

Return JSON only:
{
  "name": "",
  "title": "",
  "email": "",
  "phone": "",
  "location": "",
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
`,
      temperature: 0.35
    });

    res.json({
      success: true,
      cv: normalizeCvPayload(rawCv)
    });
  } catch (err) {
    console.error("AI FULL ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - COVER LETTER
===================================================== */
router.post("/cover-letter", auth, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 5000);
    const name = cleanText(req.body.name, 120) || "Candidate";
    const title = cleanText(req.body.title, 120) || "Job Seeker";

    if (!text) {
      return res.json({ success: false, msg: "Missing job description" });
    }

    const letter = await createTextCompletion({
      systemPrompt:
        "You write professional, natural cover letters for CV for U. Keep them truthful, confident, and easy to read. Do not invent qualifications or experience. Return plain text only.",
      userPrompt: `
Write a cover letter for this candidate.

Candidate name: ${name}
Candidate title: ${title}

Target job information:
"${text}"

Requirements:
- 3 to 4 short paragraphs.
- South African professional tone.
- Strong opening, relevant strengths, and a clear closing.
- ATS friendly without sounding robotic.
- Plain text only.
`,
      temperature: 0.5
    });

    res.json({ success: true, letter });
  } catch (err) {
    console.error("COVER LETTER ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - JOB MATCH
===================================================== */
router.post("/job-match", auth, async (req, res) => {
  try {
    const cvId = cleanText(req.body.cvId, 80);
    const platform = cleanText(req.body.platform, 60);
    const jobTitle = cleanText(req.body.jobTitle, 160);
    const jobUrl = cleanText(req.body.jobUrl, 500);
    const jobText = cleanText(req.body.jobText, 7000);

    if (!cvId) {
      return res.status(400).json({ success: false, msg: "CV ID is required" });
    }

    if (!jobText) {
      return res.status(400).json({
        success: false,
        msg: "Paste the job advert text to run a match"
      });
    }

    const cv = await CV.findOne({
      _id: cvId,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).json({ success: false, msg: "CV not found" });
    }

    if (cv.isPaid !== true) {
      return res.status(402).json({
        success: false,
        msg: "Job matching is available after this CV has been paid for"
      });
    }

    const normalizedCv = normalizeCvPayload(cv);
    const data = await createJsonCompletion({
      systemPrompt:
        "You are CV for U's job matching assistant. Compare a candidate CV against a job advert honestly and helpfully. Use only the facts in the CV and the advert. Never invent experience, qualifications, software skills, or results. Return strict JSON only.",
      userPrompt: `
Compare this CV to the advertised role and estimate how well the candidate matches it.

Candidate CV:
${JSON.stringify(normalizedCv, null, 2)}

Job advert metadata:
${JSON.stringify({ platform, jobTitle, jobUrl }, null, 2)}

Job advert text:
"""
${jobText}
"""

Instructions:
- Score the fit from 0 to 100.
- Keep the verdict short and clear.
- List the candidate's strongest matches to the advert.
- Identify real gaps or missing requirements.
- Suggest practical next steps to improve the application.
- Suggest ATS keywords from the advert worth emphasizing if the CV truly supports them.
- Write a tailored summary the candidate can use to position themselves for this role without inventing facts.
- Use plain professional language suitable for South African job seekers.

Return JSON only:
{
  "matchScore": 0,
  "verdict": "",
  "strengths": [],
  "gaps": [],
  "missingRequirements": [],
  "recommendations": [],
  "atsKeywords": [],
  "tailoredSummary": ""
}
`,
      temperature: 0.3
    });

    const match = normalizeJobMatchPayload(data);
    if (!match.verdict) {
      match.verdict = buildMatchVerdict(match.matchScore);
    }

    const historyEntry = buildJobMatchHistoryEntry({
      platform,
      jobTitle,
      jobUrl,
      jobText,
      match
    });

    cv.jobMatches = [historyEntry, ...(Array.isArray(cv.jobMatches) ? cv.jobMatches : [])]
      .slice(0, 10);
    await cv.save();

    res.json({
      success: true,
      job: {
        platform,
        jobTitle,
        jobUrl
      },
      match,
      history: cv.jobMatches
    });
  } catch (err) {
    console.error("AI JOB MATCH ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - JOB FINDER
===================================================== */
router.post("/job-finder", auth, async (req, res) => {
  try {
    const cvId = cleanText(req.body.cvId, 80);
    const preferredLocation = cleanText(req.body.preferredLocation, 120);
    const includeRemote = req.body.includeRemote === true;

    if (!cvId) {
      return res.status(400).json({ success: false, msg: "CV ID is required" });
    }

    const cv = await CV.findOne({
      _id: cvId,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).json({ success: false, msg: "CV not found" });
    }

    if (cv.isPaid !== true) {
      return res.status(402).json({
        success: false,
        msg: "Job finder is available after this CV has been paid for"
      });
    }

    const normalizedCv = normalizeCvPayload(cv);
    const data = await createJsonCompletion({
      systemPrompt:
        "You are CV for U's job finder assistant. Read a candidate CV and suggest realistic job searches that fit the candidate. Use only facts from the CV. Do not invent qualifications, years, certifications, industries, or tools. Focus on practical job searches suitable for South African job seekers. Return strict JSON only.",
      userPrompt: `
Build a job search plan from this CV.

Candidate CV:
${JSON.stringify(normalizedCv, null, 2)}

Preferences:
${JSON.stringify({
  preferredLocation: preferredLocation || null,
  includeRemote
}, null, 2)}

Instructions:
- Suggest 3 to 5 realistic target roles based on the CV.
- Keep search queries short and useful for job boards.
- Use the preferred location when it is provided, otherwise infer the strongest location from the CV.
- Estimate fit honestly from 0 to 100.
- Explain briefly why each target role fits this CV.
- Suggest practical search tips for this candidate.
- Use plain professional language suitable for South African job seekers.

Return JSON only:
{
  "locationFocus": "",
  "profileSummary": "",
  "searchTips": [],
  "targetRoles": [
    {
      "roleTitle": "",
      "searchQuery": "",
      "location": "",
      "matchScore": 0,
      "whyFit": "",
      "keywords": []
    }
  ]
}
`,
      temperature: 0.3
    });

    const plan = normalizeJobFinderPayload(data);

    if (!plan.targetRoles.length) {
      const fallbackQuery = cleanText(
        [
          normalizedCv.title,
          ...(Array.isArray(normalizedCv.skills)
            ? normalizedCv.skills.slice(0, 3)
            : [])
        ].filter(Boolean).join(" "),
        160
      ) || "jobs";

      plan.targetRoles = [
        {
          roleTitle: cleanText(normalizedCv.title, 120) || "General job search",
          searchQuery: fallbackQuery,
          location: preferredLocation || normalizedCv.location || "South Africa",
          matchScore: 50,
          whyFit: "Generated from the saved CV because no target roles were returned.",
          keywords: normalizeStringArray(normalizedCv.skills, {
            maxItems: 5,
            maxLength: 60
          })
        }
      ];
    }

    if (!plan.profileSummary) {
      plan.profileSummary =
        "Use this saved CV to start a focused job search on the recommended job boards.";
    }

    const historyEntry = buildJobSearchHistoryEntry(plan, {
      preferredLocation,
      includeRemote
    });

    if (!historyEntry.targetRoles.length) {
      return res.status(500).json({
        success: false,
        msg: "Could not generate job finder results"
      });
    }

    cv.jobSearches = [historyEntry, ...(Array.isArray(cv.jobSearches) ? cv.jobSearches : [])]
      .slice(0, 10);
    await cv.save();

    res.json({
      success: true,
      finder: historyEntry,
      history: cv.jobSearches
    });
  } catch (err) {
    console.error("AI JOB FINDER ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - SUGGEST SKILLS
===================================================== */
router.post("/suggest-skills", auth, async (req, res) => {
  try {
    const title = cleanText(req.body.title, 120);

    if (!title) {
      return res.json({ success: false, msg: "Missing title" });
    }

    const data = await createJsonCompletion({
      systemPrompt:
        "You suggest accurate, job-relevant CV skills. Return strict JSON only.",
      userPrompt: `
Suggest 8-12 skills for this job title:

"${title}"

Rules:
- Prioritize ATS-friendly skills and tools.
- Mix hard and soft skills.
- Keep each skill short.

Return JSON only:
{
  "skills": []
}
`,
      temperature: 0.3
    });

    const skills = normalizeStringArray(data.skills, {
      maxItems: 12,
      maxLength: 60
    });

    if (!skills.length) {
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, skills });
  } catch (err) {
    console.error("AI SKILLS ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - SUGGEST SUMMARY
===================================================== */
router.post("/suggest-summary", auth, async (req, res) => {
  try {
    const title = cleanText(req.body.title, 120);
    const summary = cleanText(req.body.summary, 900);

    if (!title) {
      return res.json({ success: false, msg: "Missing title" });
    }

    const data = await createJsonCompletion({
      systemPrompt:
        "You improve professional CV summaries. Return strict JSON only.",
      userPrompt: `
Improve this CV summary for the role "${title}".

Current summary:
"${summary}"

Requirements:
- 2 to 4 sentences.
- Confident and professional.
- ATS-friendly and specific to the role.
- Do not invent facts.

Return JSON only:
{
  "summary": ""
}
`,
      temperature: 0.4
    });

    const improvedSummary = cleanText(data.summary, 700);

    if (!improvedSummary) {
      return res.json({ success: false, msg: "Invalid AI JSON" });
    }

    res.json({ success: true, summary: improvedSummary });
  } catch (err) {
    console.error("AI SUMMARY ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

/* =====================================================
   AI - IMPROVE CV TEXT
===================================================== */
router.post("/improve-cv", auth, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 7000);
    const tone = cleanText(req.body.tone, 40) || "professional";

    if (!text) {
      return res.json({ success: false, msg: "Missing text" });
    }

    const toneGuide = {
      professional: "professional and polished",
      modern: "modern, energetic, and concise",
      student: "supportive, entry-level, and confidence-building",
      executive: "senior, strategic, and leadership-focused"
    };

    const improvedText = await createTextCompletion({
      systemPrompt:
        "You are CV for U's CV improvement assistant. Rewrite CV text so it reads clearly, professionally, and truthfully. Improve structure, grammar, and ATS language, but do not fabricate facts. Return plain text only.",
      userPrompt: `
Rewrite the CV text below in a ${toneGuide[tone] || toneGuide.professional} tone.

Goals:
- Keep the candidate's real facts.
- Strengthen wording and readability.
- Turn weak duties into clearer achievement-style bullets where possible without inventing results.
- Organize the output with clear section headings when helpful.

CV text:
"${text}"
`,
      temperature: 0.45
    });

    res.json({ success: true, improvedText });
  } catch (err) {
    console.error("AI IMPROVE ERROR:", err);
    res.status(500).json({ success: false, msg: "AI error" });
  }
});

module.exports = router;
