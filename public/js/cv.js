/* ======================================
   CV.JS – FINAL PRODUCTION VERSION
   ✔ Stable
   ✔ Save + Load works
   ✔ AI works (rate-safe)
   ✔ Payment gated downloads
====================================== */


console.log("🔎 URL:", window.location.href);
const API = `${window.API_BASE}/api/cv`;

const AI_API = `${window.API_BASE}/api/ai`;

/* ================= AUTH ================= */
const token = getToken();
if (!token) logout();


/* ================= STATE ================= */

const params = new URLSearchParams(window.location.search);
console.log("🔎 URL PARAM id:", params.get("id"));
const editingId =
  params.get("id") ||

  null;
console.log("🆔 editingId:", editingId);

let currentCv = { _id: null, isPaid: false };



// 

/* ================= HELPERS ================= */
const $ = id => document.getElementById(id);
const setStatus = (text, color = "#6b7280") => {
  const el = $("saveStatus");
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
};  
function updateCoverLetterCounter() {
  const btn = document.getElementById("downloadCoverPdf");
  if (!btn) return;

  const remaining = Number(currentCv.coverLettersRemaining || 0);

  btn.textContent =
    remaining > 0
      ? `Download Cover Letter (${remaining})`
      : "Pay to download Cover Letter";
}

function disableBtn(id, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = true;
  if (text) btn.textContent = text;
}

function enableBtn(id, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = false;
  if (text) btn.textContent = text;
}

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeJson(res) {
  const text = await res.text();

 if (res.status === 401 || res.status === 403 || text.startsWith("<!DOCTYPE")) {
  console.warn("Session expired");
  logout();
  return null;
}

  return JSON.parse(text);
}



let cvLoaded = false;

let saveTimeout = null;

function autoSave(delay = 800) {
  if (!cvLoaded) {
    console.warn("⛔ Autosave blocked: CV not loaded yet");
    return;
  }
  if (!currentCv._id) {
    console.warn("⛔ Autosave blocked: No CV ID yet");
    return;
  }
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveCV(), delay);
}


function updateDownloadButton() {
  const btn = document.getElementById("downloadPdfBtn");
  if (!btn) return;

  if ((currentCv.downloadsRemaining || 0) <= 0) {
    btn.disabled = false; // 🔥 IMPORTANT
    btn.textContent = "Pay to download CV";
  } else {
    btn.disabled = false;
    btn.textContent = "Download CV (PDF)";
  }
}
/* ================= DOWNLOAD COUNTER ================= */
function updateDownloadCounter() {
  const counter = document.getElementById("downloadCounter");
  if (!counter) return;

  const remaining = Number(currentCv?.downloadsRemaining || 0);
  counter.textContent = `Downloads remaining: ${remaining}`;
}


let isSaving = false;

function setTyping() {
  if (isSaving) return;
  setStatus("Typing…", "#6b7280");
}
function getWordTheme() {
  const colorMap = {
    blue: "#144f9b",
    gold: "#b08d2c",
    teal: "#0f766e",
    black: "#111827",
    grey: "#6b7280"
  };

  return {
    color: colorMap[colorSelect.value] || "#144f9b",
    template: templateSelect.value
  };
}


  
async function callAI(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg);
  }

  const data = await safeJson(res);
  if (!data) return null;

  return data; // ✅ THIS WAS MISSING
}


/* ================= DOM READY ================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("CV JS LOADED");


  const forceReloadCv = localStorage.getItem("forceReloadCv");

if (forceReloadCv) {
  console.log("🔁 Reloading CV after payment:", forceReloadCv);
  localStorage.removeItem("forceReloadCv");
  loadCV(forceReloadCv);
}


    // 🔥 RESTORE CV ID AFTER PAYMENT REDIRECT (SAFE POSITION)
  const lastCvId = localStorage.getItem("lastCvId");
  if (!editingId && lastCvId) {
    console.log("♻️ Restoring CV from lastCvId:", lastCvId);
    loadCV(lastCvId);
  }

  // 🔁 RESTORE COVER LETTER AFTER PAYFAST REDIRECT
const pendingCover = localStorage.getItem("pendingCoverLetter");
if (pendingCover && $("coverOutput")) {
  $("coverOutput").value = pendingCover;
}


if (editingId) {
  loadCV(editingId);
} else {
  console.log("🆕 New CV mode — no ID provided");
  cvLoaded = true; // allow saving
  setStatus("New CV", "#2563eb");
}



const coverModal = document.getElementById("coverLetterModal");
const coverOpenBtn = document.getElementById("coverLetterBtn");
const coverCloseBtn = document.getElementById("coverCloseBtn");

coverOpenBtn?.addEventListener("click", () => {
  coverModal.style.display = "flex";
});

coverCloseBtn?.addEventListener("click", () => {
  coverModal.style.display = "none";
});




  /* ================= ELEMENTS ================= */
  const inputName = $("inputName");
  const inputTitle = $("inputTitle");
  const inputEmail = $("inputEmail");
  const inputPhone = $("inputPhone");
  const inputLocation = $("inputLocation");
  const inputSummary = $("inputSummary");
  const inputSkills = $("inputSkills");
  const inputPhoto = $("inputPhoto");

  const cvPreview = $("cvPreview");
  const templateSelect = $("templateSelect");
  const colorSelect = $("colorSelect");

  const experienceList = $("experienceList");
  const educationList = $("educationList");
  const referencesList = $("referencesList");
  const refOnRequest = $("refOnRequest");

  const previewName = $("previewName");
  const previewTitle = $("previewTitle");
  const previewEmail = $("previewEmail");
  const previewPhone = $("previewPhone");
  const previewLocation = $("previewLocation");
  const previewSummary = $("previewSummary");
  const previewSkills = $("previewSkills");
  const previewExperience = $("previewExperience");
  const previewEducation = $("previewEducation");
  const previewReferences = $("previewReferences");
  const previewPhoto = $("previewPhoto");   


  [
  inputName,
  inputTitle,
  inputEmail,
  inputPhone,
  inputLocation,
  inputSummary
].forEach(input => {
  input.addEventListener("input", () => {
    renderPreviewFromState();
setTyping();
autoSave();
// optional but recommended
  });
});





  $("addExperienceBtn")?.addEventListener("click", () => {
  createExperienceBlock();
});

$("addEducationBtn")?.addEventListener("click", () => {
  createEducationBlock();
});

$("addReferenceBtn")?.addEventListener("click", () => {
  createReferenceBlock();
});


inputPhoto.addEventListener("change", () => {
  const file = inputPhoto.files[0];
  if (!file) return;

  // Validate image type
  if (!file.type.startsWith("image/")) {
    alert("Please upload an image file");
    return;
  }

  // Limit size (2MB recommended)
  if (file.size > 2 * 1024 * 1024) {
    alert("Image must be under 2MB");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    photoData = reader.result;       // ✅ BASE64 STRING
    previewPhoto.src = photoData;    // ✅ LIVE PREVIEW
    setStatus("Photo updated ✓", "#16a34a");
  };

  reader.readAsDataURL(file);
});

  /* ================= TEMPLATE + COLOR ================= */
 function applyTemplateAndColor() {
  if (!cvPreview || !templateSelect || !colorSelect) return;

  const template = templateSelect.value || "templateA";
  const color = colorSelect.value || "blue";

  cvPreview.className = "cv-preview";
  cvPreview.classList.add(template);
  cvPreview.classList.add(`color-${color}`);
}

  
  templateSelect.onchange = applyTemplateAndColor;
colorSelect.onchange = applyTemplateAndColor;



  /* ================= DEFAULT TEMPLATE (PRO) ================= */

  /* ================= DEFAULT TEMPLATE (PRO) ================= */

// Force Professional template on NEW CV only
if (!editingId) {
  templateSelect.value = "templateA";
  colorSelect.value = "blue";

  // Apply classes properly
  applyTemplateAndColor();
}



  $("fullAiCvBtn")?.addEventListener("click", () => {
  $("aiModal").style.display = "flex";
});

$("aiCloseBtn")?.addEventListener("click", () => {
  $("aiModal").style.display = "none";
});
 

  /* ================= SKILLS ================= */
  function refreshSkills() {
    previewSkills.innerHTML = "";
    const skills = inputSkills.value.split(",").map(s => s.trim()).filter(Boolean);
    (skills.length ? skills : ["Communication", "Teamwork", "Problem solving"])
      .forEach(s => {
        const li = document.createElement("li");
        li.textContent = s;
        previewSkills.appendChild(li);
      });
  }
  inputSkills.addEventListener("input", refreshSkills);

  /* ================= EXPERIENCE ================= */
  function refreshExperiencePreview() {
    previewExperience.innerHTML = "";
    [...experienceList.children].forEach(b => {
      const bullets = b.querySelector(".exp-bullets").value.split("\n").filter(Boolean);
      previewExperience.innerHTML += `
        <article class="cv-item">
         <h3>${b.querySelector(".exp-title").value || "Job title"} – ${b.querySelector(".exp-company").value || "Company"}</h3>
<p class="cv-meta">
  ${b.querySelector(".exp-period")?.value || ""}
</p>

          ${bullets.length ? `<ul>${bullets.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
        </article>`;
    });
  }

  function createExperienceBlock(data = {}) {
    const d = document.createElement("div");
    d.className = "exp-block";
    d.innerHTML = `
  <input class="exp-title" placeholder="Job title" value="${data.title || ""}">
  <input class="exp-company" placeholder="Company" value="${data.company || ""}">

  <!-- SAFE: optional fields -->
  <input
  class="exp-period"
  placeholder="e.g. Jan 2022 – Dec 2024"
  value="${data.dates || ""}"
>

  <textarea class="exp-bullets" placeholder="• Duties\n• Achievements">${(data.bullets || []).join("\n")}</textarea>
  <button class="small-btn danger-small">Remove</button><hr/>`;

    d.querySelector("button").onclick = () => { d.remove(); refreshExperiencePreview(); };
    d.addEventListener("input", refreshExperiencePreview);
    experienceList.appendChild(d);
    refreshExperiencePreview();
  }

  /* ================= EDUCATION ================= */
  function refreshEducationPreview() {
    previewEducation.innerHTML = "";
    [...educationList.children].forEach(b => {
      previewEducation.innerHTML += `
        <article class="cv-item">
          <h3>${b.querySelector(".edu-qualification").value || "Qualification"} – ${b.querySelector(".edu-institution").value || "Institution"}</h3>
          <p class="cv-meta">${b.querySelector(".edu-location").value || ""} • ${b.querySelector(".edu-year").value || ""}</p>
        </article>`;
    });
  }

  function createEducationBlock(data = {}) {
    const d = document.createElement("div");
    d.className = "edu-block";
    d.innerHTML = `
      <input class="edu-qualification" placeholder="Qualification" value="${data.qualification || ""}">
      <input class="edu-institution" placeholder="Institution" value="${data.institution || ""}">
      <input class="edu-location" placeholder="Location" value="${data.location || ""}">
      <input class="edu-year" placeholder="Year" value="${data.year || ""}">
      <button class="small-btn danger-small">Remove</button><hr/>`;
    d.querySelector("button").onclick = () => { d.remove(); refreshEducationPreview(); };
    d.addEventListener("input", refreshEducationPreview);
    educationList.appendChild(d);
    refreshEducationPreview();
  }

  /* ================= REFERENCES ================= */
  function refreshReferencesPreview() {
    previewReferences.innerHTML = "";
    if (refOnRequest.checked) {
      previewReferences.innerHTML = "<p>References available on request</p>";
      return;
    }
    [...referencesList.children].forEach(b => {
      previewReferences.innerHTML += `
        <p><strong>${b.querySelector(".ref-name").value || "Name"}</strong><br>
        ${b.querySelector(".ref-role").value || "Role"}<br>
        ${b.querySelector(".ref-phone").value || "Phone"}</p>`;
    });
  }

  function createReferenceBlock(data = {}) {
    const d = document.createElement("div");
    d.className = "ref-block";
    d.innerHTML = `
      <input class="ref-name" placeholder="Name" value="${data.name || ""}">
      <input class="ref-role" placeholder="Role" value="${data.role || ""}">
      <input class="ref-phone" placeholder="Phone" value="${data.phone || ""}">
      <button class="small-btn danger-small">Remove</button><hr/>`;
    d.querySelector("button").onclick = () => { d.remove(); refreshReferencesPreview(); };
    d.addEventListener("input", refreshReferencesPreview);
    referencesList.appendChild(d);
    refreshReferencesPreview();
  }

  refOnRequest.onchange = refreshReferencesPreview;

  

function renderPreviewFromState() {
  previewName.textContent = inputName.value || "Your Name";
  previewTitle.textContent = inputTitle.value || "Your Job Title";
  previewEmail.textContent = inputEmail.value || "you@email.com";
  previewPhone.textContent = inputPhone.value || "+27 71 000 0000";
  previewLocation.textContent = inputLocation.value || "Your city, Country";
  previewSummary.textContent = inputSummary.value || "Professional summary…";

  refreshSkills();
  refreshExperiencePreview();
  refreshEducationPreview();
  refreshReferencesPreview();
}

async function loadCV(id) {
  if (!id || id === "null" || id === "undefined") {
    console.warn("⚠️ loadCV called with invalid id:", id);
    return;
  }

  setStatus("Loading CV…", "#2563eb");

  const res = await fetch(`${API}/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  }); 
  
console.log("MY-CVS STATUS:", res.status);

  const raw = await res.text();
  console.log("LOAD CV RAW:", raw);

  if (raw.startsWith("<!DOCTYPE")) {
    alert("Session expired. Please log in again.");
    logout();
    return;
  }

  const data = JSON.parse(raw);

  if (!data.success || !data.cv) {
    setStatus("Failed to load CV", "#dc2626");
    return;
  }

  const cv = data.cv;

  currentCv = {
    ...cv,
    _id: cv._id,
    isPaid: cv.isPaid === true
  };
localStorage.removeItem("lastCvId");

  updateDownloadCounter();
  updateDownloadButton();
  updateCoverLetterCounter();

  /* ===============================
     ✅ RESTORE COVER LETTER HERE
  =============================== */
  // 🔐 Preserve unsaved cover letter text during reload
const existingCoverText =
  $("coverOutput")?.value?.trim() || null;
if ($("coverOutput")) {
  $("coverOutput").value =
    existingCoverText || cv.coverLetter || "";
}


  // PHOTO
  if (cv.photo) {
    photoData = cv.photo;
    currentCv.photo = cv.photo;
    previewPhoto.src = cv.photo;
  } else {
    photoData = null;
    currentCv.photo = null;
    previewPhoto.src = "images/default-avatar.png";
  }

  // BASIC FIELDS
  inputName.value = cv.name || "";
  inputTitle.value = cv.title || "";
  inputEmail.value = cv.email || "";
  inputPhone.value = cv.phone || "";
  inputLocation.value = cv.location || "";
  inputSummary.value = cv.summary || "";
  inputSkills.value = (cv.skills || []).join(", ");

  // DESIGN
  templateSelect.value = cv.template || "templateA";
  colorSelect.value = cv.color || "blue";
  applyTemplateAndColor();

  // LISTS
  refreshSkills();
  experienceList.innerHTML = "";
  educationList.innerHTML = "";
  referencesList.innerHTML = "";

  (cv.experience || []).forEach(createExperienceBlock);
  (cv.education || []).forEach(createEducationBlock);
  (cv.references || []).forEach(createReferenceBlock);

  renderPreviewFromState();

  cvLoaded = true;
  setStatus("CV loaded ✓", "#16a34a");
}




/* ================= SAVE CV ================= */
async function saveCV(redirect = false) {

  
  // 🔒 Block save if editing but not loaded yet
  if (editingId && !cvLoaded) {
    console.log("⏳ CV not loaded yet – save blocked");
    return false;
  }

  // 🔒 Prevent double save
  if (isSaving) return false;
  isSaving = true;

  setStatus("Saving CV…", "#2563eb");

  const payload = {
    _id: currentCv._id || null,

    name: clean(inputName.value),
    title: clean(inputTitle.value),
    email: clean(inputEmail.value),
    phone: clean(inputPhone.value),
    location: clean(inputLocation.value),
    summary: clean(inputSummary.value),

    skills: inputSkills.value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),

    template: templateSelect.value,
    color: colorSelect.value,

    photo: photoData || currentCv.photo || null,

   experience: [...experienceList.children].map(b => ({
  title: clean(b.querySelector(".exp-title").value),
  company: clean(b.querySelector(".exp-company").value),

  // ✅ MATCHES SCHEMA
  dates: clean(b.querySelector(".exp-period")?.value || ""),

  bullets: b.querySelector(".exp-bullets").value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean)
})),


    education: [...educationList.children].map(b => ({
      qualification: clean(b.querySelector(".edu-qualification").value),
      institution: clean(b.querySelector(".edu-institution").value),
      location: clean(b.querySelector(".edu-location").value),
      year: clean(b.querySelector(".edu-year").value)
    })),

    references: refOnRequest.checked
      ? []
      : [...referencesList.children].map(b => ({
          name: clean(b.querySelector(".ref-name").value),
          role: clean(b.querySelector(".ref-role").value),
          phone: clean(b.querySelector(".ref-phone").value)
        }))
  };

  try {
    const res = await fetch(`${API}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await safeJson(res);
    if (!data || !data.success || !data.cv) {
      throw new Error("Invalid save response");
    }

    // ✅ UPDATE STATE
    currentCv = data.cv;
    cvLoaded = true;

    // 🔥 CRITICAL FIX: persist CV ID
    localStorage.setItem("lastCvId", currentCv._id);

    setStatus("Saved ✓", "#16a34a");

    if (redirect) {
      window.location.href = "dashboard.html";
    }

    return true;

  } catch (err) {
    console.error("❌ SAVE ERROR:", err);
    setStatus("Save failed", "#dc2626");
    return false;

  } finally {
    isSaving = false;
  }
}

/* ================= SAVE BUTTON ================= */
$("saveCvBtn")?.addEventListener("click", async () => {
  const btn = $("saveCvBtn");

  disableBtn("saveCvBtn", "Saving…");
  setStatus("Saving CV…", "#2563eb");

  const ok = await saveCV(true);

  if (!ok) {
    enableBtn("saveCvBtn", "Save CV");
    setStatus("Save failed", "#dc2626");
    alert("Save failed");
  }
});



  /* ================= AI BUTTONS ================= */
 $("aiBuildBtn")?.addEventListener("click", async () => {
  const prompt = $("aiInput").value.trim();
  if (!prompt) return alert("Describe yourself");

  setStatus("AI is generating…", "#2563eb");

  try {
    const res = await callAI(`${AI_API}/quick-build`, { prompt });

    if (!res.success || !res.cv) {
      setStatus("AI failed", "#dc2626");
      return;
    }

    loadAI(res.cv);
  } catch (err) {
    setStatus("AI error", "#dc2626");
    alert("AI failed");
  }
});


$("aiFullGenerateBtn")?.addEventListener("click", async () => {
  const prompt = $("aiFullInput").value.trim();
  if (!prompt) return alert("Describe your experience");

  setStatus("AI is generating full CV…", "#2563eb");

  try {
    const res = await callAI(`${AI_API}/full-cv`, { text: prompt });

    if (!res.success || !res.cv) {
      setStatus("AI failed", "#dc2626");
      return;
    }

    loadAI(res.cv);
    $("aiModal").style.display = "none";
  } catch (err) {
    setStatus("AI error", "#dc2626");
    alert("Full AI failed");
  }
});



$("suggestSkillsBtn")?.addEventListener("click", async () => {
  try {
    const data = await callAI(`${AI_API}/suggest-skills`, {
      title: inputTitle.value
    });
    if (data?.skills) {
      inputSkills.value = data.skills.join(", ");
      refreshSkills();
    }
  } catch {
    alert("Skill suggestion failed");
  }
});


 $("suggestSummaryBtn")?.addEventListener("click", async () => {
  try {
    const data = await callAI(`${AI_API}/suggest-summary`, {
      title: inputTitle.value,
      summary: inputSummary.value
    });
    if (data?.summary) {
      inputSummary.value = data.summary;
      previewSummary.textContent = data.summary;
    }
  } catch {
    alert("Summary suggestion failed");
  }
});


  function loadAI(data) {
    inputName.value = data.name || inputName.value;
    inputTitle.value = data.title || inputTitle.value;
    inputSummary.value = data.summary || inputSummary.value;
    if (Array.isArray(data.skills)) {
      inputSkills.value = data.skills.join(", ");
      refreshSkills();
    }
    if (Array.isArray(data.experience)) {
      experienceList.innerHTML = "";
      data.experience.forEach(createExperienceBlock);
    }
    if (Array.isArray(data.education)) {
      educationList.innerHTML = "";
      data.education.forEach(createEducationBlock);
    }
    setStatus("AI generated ✓", "#16a34a");
  }

  /* ================= COVER LETTER DOWNLOADS ================= */

$("coverGenerateBtn")?.addEventListener("click", async () => {
  const btn = $("coverGenerateBtn");
  const text = $("coverInput").value.trim();

  if (!text) return alert("Paste job description");

  if (!currentCv._id) {
    alert("Please save your CV first");
    return;
  }

  // 🔥 UI FEEDBACK
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Generating…";

  try {
    const res = await callAI(`${AI_API}/cover-letter`, {
      text,
      name: inputName.value,
      title: inputTitle.value
    });

    if (!res?.success || !res.letter) {
      alert("Cover letter failed");
      return;
    }

    // ✅ PUT INTO UI
    $("coverOutput").value = res.letter;

    // 🔥 SAVE TO DB
    await fetch(`${API}/${currentCv._id}/cover-letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ coverLetter: res.letter })
    });

  } catch (err) {
    alert("Cover letter AI failed");
  } finally {
    // 🔁 RESTORE BUTTON
    btn.disabled = false;
    btn.textContent = originalText;
  }
});


/* ================= CV PDF DOWNLOAD ================= */
document.getElementById("downloadPdfBtn")
  ?.addEventListener("click", async () => {

    if (!currentCv._id) {
      alert("Please save your CV first");
      return;
    }

    disableBtn("downloadPdfBtn", "Processing…");

    const previewHtml =
      document.getElementById("cvPreview").outerHTML;

    const res = await fetch(
      `${window.API_BASE}/api/pdf/cv/${currentCv._id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ html: previewHtml })
      }
    );

    // 🔥 MUST BE FIRST
    if (res.status === 402) {
      window.location.replace(
        `pay.html?type=cv&cv=${currentCv._id}`
      );
      return;
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("PDF ERROR:", err);
      enableBtn("downloadPdfBtn", "Pay to download CV");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "CV.pdf";
    a.click();

    URL.revokeObjectURL(url);
    enableBtn("downloadPdfBtn", "Download CV (PDF)");
  });


/* ================= PDF DOWNLOAD ================= */
document.getElementById("downloadCoverPdf")
  ?.addEventListener("click", async () => {

    if (!currentCv._id) {
      alert("Please save your CV first");
      return;
    }

    disableBtn("downloadCoverPdf", "Downloading…");

    const res = await fetch(
      `${window.API_BASE}/api/pdf/cover-letter/${currentCv._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 402) {
      enableBtn("downloadCoverPdf", "Pay to download Cover Letter");
      window.location.href =
        `pay.html?type=cover-letter&cv=${currentCv._id}`;
      return;
    }

    if (!res.ok) {
      alert("Cover letter download failed");
      enableBtn("downloadCoverPdf", "Download Cover Letter");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Cover_Letter.pdf";
    a.click();

    URL.revokeObjectURL(url);

    await loadCV(currentCv._id);
    enableBtn("downloadCoverPdf", "Download Cover Letter");
  });


  if (!experienceList.children.length) createExperienceBlock();
  if (!educationList.children.length) createEducationBlock();
});
