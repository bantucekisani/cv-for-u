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

let pendingOpenJobMatch =
  params.get("openJobFinder") === "1" ||
  params.get("openJobMatch") === "1";
let currentCv = { _id: null, isPaid: false, jobMatches: [], jobSearches: [] };



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

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function getApiErrorMessage(error, fallback = "Something went wrong.") {
  const raw = String(error?.message || "").trim();

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed.msg || parsed.message || fallback;
  } catch {
    return raw.length > 220 ? fallback : raw;
  }
}

function setJobMatchMessage(message, type = "error") {
  const element = $("jobMatchMessage");
  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.style.color = type === "success" ? "#166534" : "#b91c1c";
}

function renderJobBoardLinks(target = {}) {
  const links = [
    { label: "Indeed", url: target.indeedUrl },
    { label: "LinkedIn", url: target.linkedinUrl },
    { label: "Pnet", url: target.pnetUrl },
    { label: "Careers24", url: target.careers24Url },
    { label: "Job Mail", url: target.jobmailUrl }
  ].filter(item => /^https?:\/\//i.test(item.url || ""));

  if (!links.length) {
    return "";
  }

  return `
    <div class="job-board-links">
      ${links.map(link => `
        <a class="job-board-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
          ${escapeHtml(link.label)}
        </a>
      `).join("")}
    </div>
  `;
}

function renderJobMatchResult(result = null) {
  const resultBox = $("jobMatchResult");
  if (!resultBox) {
    return;
  }

  if (!result) {
    resultBox.innerHTML = "";
    resultBox.style.display = "none";
    return;
  }

  resultBox.innerHTML = `
    <div class="job-match-meta">
      <strong>Job search plan ready</strong>
      <div>${escapeHtml(result.locationFocus || "South Africa")}</div>
    </div>
    ${result.profileSummary ? `
      <div class="job-match-card" style="margin-bottom:12px;">
        <h4>Search Summary</h4>
        <p>${escapeHtml(result.profileSummary)}</p>
      </div>
    ` : ""}
    ${Array.isArray(result.searchTips) && result.searchTips.length ? `
      <div class="job-match-card" style="margin-bottom:12px;">
        <h4>Search Tips</h4>
        <ul>${result.searchTips.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    ` : ""}
    <div class="job-match-grid">
      ${(Array.isArray(result.targetRoles) ? result.targetRoles : []).map(target => {
        const score = Number(target.matchScore || 0);
        let scoreColor = "#b91c1c";

        if (score >= 80) {
          scoreColor = "#166534";
        } else if (score >= 60) {
          scoreColor = "#b45309";
        }

        return `
          <div class="job-match-card">
            <div class="job-match-history-header">
              <div>
                <strong>${escapeHtml(target.roleTitle || "Target role")}</strong>
                <div class="job-match-meta">${escapeHtml(target.location || result.locationFocus || "South Africa")}</div>
              </div>
              <span class="job-match-score" style="background:${scoreColor};">${score}%</span>
            </div>
            <p class="job-match-summary-line"><strong>Search:</strong> ${escapeHtml(target.searchQuery || target.roleTitle || "")}</p>
            ${target.whyFit ? `<p class="job-match-summary-line">${escapeHtml(target.whyFit)}</p>` : ""}
            ${Array.isArray(target.keywords) && target.keywords.length ? `
              <p class="job-match-summary-line"><strong>Keywords:</strong> ${target.keywords.map(item => escapeHtml(item)).join(", ")}</p>
            ` : ""}
            ${renderJobBoardLinks(target)}
          </div>
        `;
      }).join("")}
    </div>
  `;
  resultBox.style.display = "block";
}

function formatJobMatchDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function renderJobMatchHistory(matches = []) {
  const historyBox = $("jobMatchHistory");
  if (!historyBox) {
    return;
  }

  const items = Array.isArray(matches) ? matches : [];
  if (!items.length) {
    historyBox.innerHTML = `
      <h3>Saved Job Searches</h3>
      <div class="job-match-empty">No saved job searches yet. Run the finder to keep a history here.</div>
    `;
    return;
  }

  historyBox.innerHTML = `
    <h3>Saved Job Searches</h3>
    ${items.slice(0, 5).map(item => {
      const topRole = item?.targetRoles?.[0] || {};
      const jobTitle = escapeHtml(topRole.roleTitle || "Untitled role");
      const locationFocus = escapeHtml(item.locationFocus || "South Africa");
      const dateLabel = escapeHtml(formatJobMatchDate(item.createdAt));
      const summary = escapeHtml(item.profileSummary || topRole.whyFit || "");
      const safeUrl = /^https?:\/\//i.test(topRole.indeedUrl || "")
        ? escapeHtml(topRole.indeedUrl)
        : "";

      return `
        <div class="job-match-history-item">
          <div class="job-match-history-header">
            <div>
              <strong>${jobTitle}</strong>
              <div class="job-match-meta">${locationFocus}${dateLabel ? ` | ${dateLabel}` : ""}</div>
            </div>
            <span class="job-match-score">${Number(topRole.matchScore || 0)}%</span>
          </div>
          <p class="job-match-summary-line">${Number(item.targetRoles?.length || 0)} search target(s)</p>
          ${summary ? `<p class="job-match-summary-line">${summary}</p>` : ""}
          ${safeUrl ? `<a class="job-match-link" href="${safeUrl}" target="_blank" rel="noopener">Open top Indeed search</a>` : ""}
        </div>
      `;
    }).join("")}
  `;
}

function touchCv(delay = 800) {
  setTyping();
  autoSave(delay);
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


let photoData = null;
let cvLoaded = false;

let saveTimeout = null;

function autoSave(delay = 800) {

  if (!cvLoaded) {
    console.warn("⛔ Autosave blocked: CV not loaded yet");
    return;
  }

  if (!currentCv._id && editingId) {
    console.warn("⛔ Autosave blocked: no CV ID");
    return;
  }

  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    if (!isSaving) saveCV({ silent: true });
  }, delay);
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

  document.title = "CV for U - AI CV Builder";

  const appName = document.querySelector(".app-name");
  if (appName && !appName.textContent.trim()) {
    appName.textContent = "CV for U";
  }

  const quickBuilderHeading = document.querySelector(".ai-box h2");
  if (quickBuilderHeading) {
    quickBuilderHeading.textContent = "AI CV Assistant";
  }

  const quickBuilderCopy = document.querySelector(".ai-box p");
  if (quickBuilderCopy) {
    quickBuilderCopy.textContent =
      "Give the assistant rough notes and it will build a first draft. Include your target role, years of experience, tools, industries, and achievements for the best result.";
  }

  if ($("aiInput")) {
    $("aiInput").placeholder =
      "Example: I am a cashier with 2 years of retail experience, strong customer service skills, till operations, stock counting, and daily cash-ups.";
  }

  if ($("aiBuildBtn")) {
    $("aiBuildBtn").textContent = "Build Draft with AI";
  }

  if ($("fullAiCvBtn")) {
    $("fullAiCvBtn").textContent = "Open Full AI Assistant";
  }

  const fullAiHeading = document.querySelector("#aiModal h2");
  if (fullAiHeading) {
    fullAiHeading.textContent = "AI Full CV Assistant";
  }

  const fullAiCopy = document.querySelector("#aiModal p");
  if (fullAiCopy) {
    fullAiCopy.textContent =
      "Paste your work history, education, skills, and target role. The assistant will turn it into a stronger CV draft.";
  }

  if ($("aiFullInput")) {
    $("aiFullInput").placeholder =
      "Example: I worked 4 years as a retail assistant at Pick n Pay, handled stock and tills, trained new staff, and completed a retail management certificate.";
  }

  if ($("aiFullGenerateBtn")) {
    $("aiFullGenerateBtn").textContent = "Build My CV Draft";
  }

  const coverHeading = document.querySelector("#coverLetterModal h2");
  if (coverHeading) {
    coverHeading.textContent = "AI Cover Letter Assistant";
  }

  const coverCopy = document.querySelector("#coverLetterModal p");
  if (coverCopy) {
    coverCopy.textContent =
      "Paste the job post or describe the role. The assistant will tailor your cover letter to match it.";
  }

  if ($("downloadCoverPdf")) {
    $("downloadCoverPdf").textContent = "Download Cover Letter (PDF)";
  }

  /* ======================================
     🔁 HANDLE PAYFAST RETURN (CRITICAL)
  ====================================== */

  const forceReloadCv = localStorage.getItem("forceReloadCv");

  if (forceReloadCv) {
    console.log("🔁 Reloading CV after payment:", forceReloadCv);
    localStorage.removeItem("forceReloadCv");
    loadCV(forceReloadCv);
  }

  // 🟢 OPTIMISTIC COVER LETTER CREDIT (R25 FIX)
 const coverJustPaid = localStorage.getItem("coverJustPaid");

if (coverJustPaid === "1") {
  console.log("🟢 Applying optimistic cover letter credit");

  currentCv.coverLettersRemaining =
    Math.max(1, Number(currentCv.coverLettersRemaining || 0));

  updateCoverLetterCounter();

  // 🔥 DO NOT REMOVE YET
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
  renderJobMatchHistory([]);

}



const coverModal = document.getElementById("coverLetterModal");
const coverOpenBtn = document.getElementById("coverLetterBtn");
const coverCloseBtn = document.getElementById("coverCloseBtn");
const aiModal = document.getElementById("aiModal");
const jobMatchModal = document.getElementById("jobMatchModal");
const jobMatchOpenBtn = document.getElementById("jobMatchBtn");
const jobMatchCloseBtn = document.getElementById("jobMatchCloseBtn");

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.style.display = "flex";
  modal.scrollTop = 0;
  modal.querySelector(".ai-modal")?.scrollTo({ top: 0, behavior: "auto" });
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.style.display = "none";
}

function openJobMatchModal() {
  const locationInput = $("jobFinderLocation");

  if (locationInput && !locationInput.value.trim() && currentCv.location) {
    locationInput.value = currentCv.location;
  }

  renderJobMatchResult((currentCv.jobSearches || [])[0] || null);
  renderJobMatchHistory(currentCv.jobSearches || []);
  openModal(jobMatchModal);
}

coverOpenBtn?.addEventListener("click", () => {
  openModal(coverModal);
});

coverCloseBtn?.addEventListener("click", () => {
  closeModal(coverModal);
});

jobMatchOpenBtn?.addEventListener("click", () => {
  openJobMatchModal();
});

jobMatchCloseBtn?.addEventListener("click", () => {
  closeModal(jobMatchModal);
});

[aiModal, coverModal, jobMatchModal].forEach(modal => {
  modal?.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") {
    return;
  }

  closeModal(aiModal);
  closeModal(coverModal);
  closeModal(jobMatchModal);
});

if (!editingId && pendingOpenJobMatch) {
  openJobMatchModal();
  pendingOpenJobMatch = false;
}




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
  createExperienceBlock({}, { triggerSave: true });
});

$("addEducationBtn")?.addEventListener("click", () => {
  createEducationBlock({}, { triggerSave: true });
});

$("addReferenceBtn")?.addEventListener("click", () => {
  createReferenceBlock({}, { triggerSave: true });
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

  const img = new Image();

  img.onload = () => {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const maxWidth = 500;
    const scale = maxWidth / img.width;

    canvas.width = maxWidth;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    photoData = canvas.toDataURL("image/jpeg", 0.8);

    previewPhoto.src = photoData;

    setStatus("Photo updated", "#16a34a");
    autoSave(200);
  };

  img.src = reader.result;
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

  
  templateSelect.onchange = () => {
  applyTemplateAndColor();
  touchCv(200);
};
colorSelect.onchange = () => {
  applyTemplateAndColor();
  touchCv(200);
};



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
  openModal(aiModal);
});

$("aiCloseBtn")?.addEventListener("click", () => {
  closeModal(aiModal);
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
  inputSkills.addEventListener("input", () => {
    refreshSkills();
    touchCv();
  });

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

  function createExperienceBlock(data = {}, options = {}) {
    const { triggerSave = false } = options;
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

    d.querySelector("button").onclick = () => {
      d.remove();
      refreshExperiencePreview();
      touchCv(200);
    };
    d.addEventListener("input", () => {
      refreshExperiencePreview();
      touchCv();
    });
    experienceList.appendChild(d);
    refreshExperiencePreview();
    if (triggerSave) {
      touchCv(200);
    }
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

  function createEducationBlock(data = {}, options = {}) {
    const { triggerSave = false } = options;
    const d = document.createElement("div");
    d.className = "edu-block";
    d.innerHTML = `
      <input class="edu-qualification" placeholder="Qualification" value="${data.qualification || ""}">
      <input class="edu-institution" placeholder="Institution" value="${data.institution || ""}">
      <input class="edu-location" placeholder="Location" value="${data.location || ""}">
      <input class="edu-year" placeholder="Dates attended or expected completion" value="${data.year || ""}">
      <p class="helper-text edu-help">Example: 2021 - 2024, Jan 2023 - Present, or Expected 2027</p>
      <button class="small-btn danger-small">Remove</button><hr/>`;
    d.querySelector("button").onclick = () => {
      d.remove();
      refreshEducationPreview();
      touchCv(200);
    };
    d.addEventListener("input", () => {
      refreshEducationPreview();
      touchCv();
    });
    educationList.appendChild(d);
    refreshEducationPreview();
    if (triggerSave) {
      touchCv(200);
    }
  }

  /* ================= REFERENCES ================= */
  function refreshReferencesPreview() {
    previewReferences.innerHTML = "";
    if (refOnRequest.checked) {
      previewReferences.innerHTML = "<p>References available on request</p>";
      return;
    }
    [...referencesList.children].forEach(b => {
      const role = b.querySelector(".ref-role").value.trim();
      const company = b.querySelector(".ref-company").value.trim();
      const phone = b.querySelector(".ref-phone").value || "Phone";
      const roleAndCompany = [role, company].filter(Boolean).join(" - ") || "Role - Company";

      previewReferences.innerHTML += `
        <p><strong>${b.querySelector(".ref-name").value || "Name"}</strong><br>
        ${roleAndCompany}<br>
        ${phone}</p>`;
    });
  }

  function createReferenceBlock(data = {}, options = {}) {
    const { triggerSave = false } = options;
    const d = document.createElement("div");
    d.className = "ref-block";
    d.innerHTML = `
      <input class="ref-name" placeholder="Name" value="${data.name || ""}">
      <input class="ref-role" placeholder="Role" value="${data.role || ""}">
      <input class="ref-company" placeholder="Company" value="${data.company || ""}">
      <input class="ref-phone" placeholder="Phone" value="${data.phone || ""}">
      <button class="small-btn danger-small">Remove</button><hr/>`;
    d.querySelector("button").onclick = () => {
      d.remove();
      refreshReferencesPreview();
      touchCv(200);
    };
    d.addEventListener("input", () => {
      refreshReferencesPreview();
      touchCv();
    });
    referencesList.appendChild(d);
    refreshReferencesPreview();
    if (triggerSave) {
      touchCv(200);
    }
  }

  refOnRequest.onchange = () => {
    refreshReferencesPreview();
    touchCv(200);
  };

  

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
  renderJobMatchHistory(currentCv.jobSearches || []);

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
  refOnRequest.checked = cv.referencesOnRequest === true;

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
  setStatus("CV loaded", "#16a34a");

  if (pendingOpenJobMatch) {
    openJobMatchModal();
    pendingOpenJobMatch = false;
  }
}


/* ================= SAVE CV ================= */
async function saveCV({ silent = false } = {}) {

  if (editingId && !cvLoaded) {
    console.log("⏳ CV not loaded yet – save blocked");
    return false;
  }

  if (isSaving) return false;
  isSaving = true;

  if (!silent) {
    disableBtn("saveCvBtn", "Saving…");
    setStatus("Saving CV…", "#2563eb");
  }

  const payload = {
    _id: currentCv._id || null,

    name: clean(inputName.value),
    title: clean(inputTitle.value),
    email: clean(inputEmail.value),
    phone: clean(inputPhone.value),
    location: clean(inputLocation.value),
    summary: clean(inputSummary.value),

    skills: inputSkills.value.split(",").map(s => s.trim()).filter(Boolean),

    template: templateSelect.value,
    color: colorSelect.value,

    photo: photoData || currentCv.photo || null,

    experience: [...experienceList.children].map(b => ({
      title: clean(b.querySelector(".exp-title").value),
      company: clean(b.querySelector(".exp-company").value),
      dates: clean(b.querySelector(".exp-period")?.value || ""),
      bullets: b.querySelector(".exp-bullets").value
        .split("\n").map(x => x.trim()).filter(Boolean)
    })),

    education: [...educationList.children].map(b => ({
      qualification: clean(b.querySelector(".edu-qualification").value),
      institution: clean(b.querySelector(".edu-institution").value),
      location: clean(b.querySelector(".edu-location").value),
      year: clean(b.querySelector(".edu-year").value)
    })),

    references: [...referencesList.children].map(b => ({
        name: clean(b.querySelector(".ref-name").value),
        role: clean(b.querySelector(".ref-role").value),
        company: clean(b.querySelector(".ref-company").value),
        phone: clean(b.querySelector(".ref-phone").value)
      })),

    referencesOnRequest: refOnRequest.checked
  };

  try {

    // 🔥 FIX 3 — TIMEOUT PROTECTION FOR IPHONE
    const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20000);

    let res;

    try {
    res = await fetch(`${API}/save`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify(payload),
  signal: controller.signal
});  

    } catch (err) {
      console.error("❌ SAVE TIMEOUT OR NETWORK ERROR:", err);
      clearTimeout(timeout);
      throw err;
    }

    clearTimeout(timeout);

    const data = await safeJson(res);
    if (!data?.success || !data.cv) {
      throw new Error("Invalid save response");
    }

    currentCv = data.cv;
    cvLoaded = true;
    renderJobMatchHistory(currentCv.jobSearches || []);

    if (!silent) {
      setStatus("Saved", "#16a34a");
    }

    return true;

  } catch (err) {
    console.error("❌ SAVE ERROR:", err);

    if (!silent) {
      setStatus("Save failed", "#dc2626");
    }

    return false;

  } finally {
    isSaving = false;

    if (!silent) {
      enableBtn("saveCvBtn", "Save CV");
    }
  }
}

/* ================= SAVE BUTTON ================= */
$("saveCvBtn")?.addEventListener("click", async () => {
  const ok = await saveCV();

  if (!ok) {
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
    closeModal(aiModal);
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
      autoSave();
      setStatus("Skills suggested ✓", "#16a34a");
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
      renderPreviewFromState();
      autoSave();
      setStatus("Summary suggested ✓", "#16a34a");
    }
  } catch {
    alert("Summary suggestion failed");
  }
});

 $("jobMatchGenerateBtn")?.addEventListener("click", async () => {
  const btn = $("jobMatchGenerateBtn");
  const preferredLocation = $("jobFinderLocation")?.value.trim() || "";
  const includeRemote = $("jobFinderRemote")?.checked === true;

  setJobMatchMessage("");
  renderJobMatchResult(null);

  const saved = await saveCV({ silent: true });
  if (!saved || !currentCv._id) {
    setJobMatchMessage("Please save your CV before running the job finder.");
    return;
  }

  if (currentCv.isPaid !== true) {
    setJobMatchMessage("Job finder is available after this CV has been paid for.");
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Finding jobs...";

  try {
    const res = await callAI(`${AI_API}/job-finder`, {
      cvId: currentCv._id,
      preferredLocation,
      includeRemote
    });

    if (!res?.success || !res.finder) {
      throw new Error("Job finder failed");
    }

    renderJobMatchResult(res.finder);
    currentCv.jobSearches = Array.isArray(res.history) ? res.history : (currentCv.jobSearches || []);
    renderJobMatchHistory(currentCv.jobSearches);
    setJobMatchMessage("Job finder ready.", "success");
    setStatus("Job finder ready", "#16a34a");
  } catch (err) {
    setJobMatchMessage(
      getApiErrorMessage(err, "Job finder failed. Please try again.")
    );
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
 });


  function loadAI(data) {
    inputName.value = data.name || inputName.value;
    inputTitle.value = data.title || inputTitle.value;
    inputEmail.value = data.email || inputEmail.value;
    inputPhone.value = data.phone || inputPhone.value;
    inputLocation.value = data.location || inputLocation.value;
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
    renderPreviewFromState();
    autoSave(200);
    setStatus("AI generated ✓", "#16a34a");
  }

  function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function openPendingDownloadWindow(message = "Preparing your PDF...") {
    try {
      const popup = window.open("", "_blank");

      if (!popup) {
        return null;
      }

      popup.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Preparing PDF</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #f8fbff;
              color: #144f9b;
              text-align: center;
            }
          </style>
        </head>
        <body>${escapeHtml(message)}</body>
        </html>
      `);
      popup.document.close();
      return popup;
    } catch {
      return null;
    }
  }

  function closePendingDownloadWindow(popup) {
    try {
      if (popup && !popup.closed) {
        popup.close();
      }
    } catch {}
  }

  function openDirectDownload(url, popup = null) {
    if (popup && !popup.closed) {
      popup.location.replace(url);
      return true;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  async function saveCoverLetterDraft(coverLetterText = $("coverOutput")?.value || "") {
    const coverLetter = String(coverLetterText || "").trim();

    if (!currentCv._id || !coverLetter) {
      return false;
    }

    const res = await fetch(`${API}/${currentCv._id}/cover-letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ coverLetter })
    });

    if (!res.ok) {
      throw new Error("Cover letter save failed");
    }

    currentCv.coverLetter = coverLetter;
    return true;
  }

  function decrementRemainingCount(fieldName) {
    currentCv[fieldName] =
      Math.max(0, Number(currentCv[fieldName] || 0) - 1);
  }

  function attachFixedDownloadHandlers() {
    const currentCvDownloadBtn = document.getElementById("downloadPdfBtn");
    if (currentCvDownloadBtn) {
      const freshCvDownloadBtn = currentCvDownloadBtn.cloneNode(true);
      currentCvDownloadBtn.replaceWith(freshCvDownloadBtn);

      freshCvDownloadBtn.addEventListener("click", async () => {
        const iosDownloadWindow = isIOSDevice()
          ? openPendingDownloadWindow("Preparing your CV PDF...")
          : null;

        if (!currentCv._id) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Please save your CV first");
          return;
        }

        if (Number(currentCv.downloadsRemaining || 0) <= 0) {
          closePendingDownloadWindow(iosDownloadWindow);
          window.location.href = `pay.html?type=cv&cv=${currentCv._id}`;
          return;
        }

        const saved = await saveCV({ silent: true });

        if (!saved) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Save failed. Please try again.");
          return;
        }

        disableBtn("downloadPdfBtn", "Processing...");

        const directUrl =
          `${window.API_BASE}/api/pdf/cv/${currentCv._id}?token=${encodeURIComponent(token)}&inline=1`;

        if (isIOSDevice()) {
          openDirectDownload(directUrl, iosDownloadWindow);
          decrementRemainingCount("downloadsRemaining");
          updateDownloadCounter();
          updateDownloadButton();
          setStatus("PDF opened in a new tab. On iPhone, use Share to save it.", "#16a34a");
          setTimeout(() => {
            if (currentCv._id) {
              loadCV(currentCv._id);
            }
          }, 1500);
          enableBtn("downloadPdfBtn", "Download CV (PDF)");
          return;
        }

        let res;

        try {
          res = await fetch(`${window.API_BASE}/api/pdf/cv/${currentCv._id}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        } catch (err) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Network error. Please try again.");
          enableBtn("downloadPdfBtn", "Download CV (PDF)");
          return;
        }

        if (res.status === 402) {
          closePendingDownloadWindow(iosDownloadWindow);
          enableBtn("downloadPdfBtn", "Pay to download CV");
          window.location.href = `pay.html?type=cv&cv=${currentCv._id}`;
          return;
        }

        if (res.status === 401 || res.status === 403) {
          closePendingDownloadWindow(iosDownloadWindow);
          logout();
          return;
        }

        if (!res.ok) {
          closePendingDownloadWindow(iosDownloadWindow);
          const err = await res.text();
          console.error("PDF ERROR:", err);
          enableBtn("downloadPdfBtn", "Download CV (PDF)");
          return;
        }

        try {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = "CV.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();

          setTimeout(() => URL.revokeObjectURL(url), 5000);

          decrementRemainingCount("downloadsRemaining");
          updateDownloadCounter();
          updateDownloadButton();
        } catch (err) {
          console.error("Download error:", err);
          alert("Download failed");
        }

        enableBtn("downloadPdfBtn", "Download CV (PDF)");
      });
    }

    const currentCoverDownloadBtn = document.getElementById("downloadCoverPdf");
    if (currentCoverDownloadBtn) {
      const freshCoverDownloadBtn = currentCoverDownloadBtn.cloneNode(true);
      currentCoverDownloadBtn.replaceWith(freshCoverDownloadBtn);

      freshCoverDownloadBtn.addEventListener("click", async () => {
        const iosDownloadWindow = isIOSDevice()
          ? openPendingDownloadWindow("Preparing your cover letter PDF...")
          : null;

        if (!currentCv._id) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Please save your CV first");
          return;
        }

        const coverText =
          $("coverOutput")?.value?.trim() ||
          String(currentCv.coverLetter || "").trim();

        if (!coverText) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Generate your cover letter first");
          return;
        }

        if (Number(currentCv.coverLettersRemaining || 0) <= 0) {
          closePendingDownloadWindow(iosDownloadWindow);
          window.location.href = `pay.html?type=cover-letter&cv=${currentCv._id}`;
          return;
        }

        try {
          await saveCoverLetterDraft(coverText);
        } catch (err) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Could not save your cover letter. Please try again.");
          return;
        }

        disableBtn("downloadCoverPdf", "Processing...");

        const directUrl =
          `${window.API_BASE}/api/pdf/cover-letter/${currentCv._id}?token=${encodeURIComponent(token)}&inline=1`;

        if (isIOSDevice()) {
          openDirectDownload(directUrl, iosDownloadWindow);
          decrementRemainingCount("coverLettersRemaining");
          updateCoverLetterCounter();
          setStatus("PDF opened in a new tab. On iPhone, use Share to save it.", "#16a34a");
          setTimeout(() => {
            if (currentCv._id) {
              loadCV(currentCv._id);
            }
          }, 1500);
          enableBtn("downloadCoverPdf", "Download Cover Letter");
          return;
        }

        let res;

        try {
          res = await fetch(`${window.API_BASE}/api/pdf/cover-letter/${currentCv._id}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        } catch (err) {
          closePendingDownloadWindow(iosDownloadWindow);
          alert("Network error. Please try again.");
          enableBtn("downloadCoverPdf", "Download Cover Letter");
          return;
        }

        if (res.status === 402) {
          closePendingDownloadWindow(iosDownloadWindow);
          enableBtn("downloadCoverPdf", "Pay to download Cover Letter");
          window.location.href = `pay.html?type=cover-letter&cv=${currentCv._id}`;
          return;
        }

        if (res.status === 401 || res.status === 403) {
          closePendingDownloadWindow(iosDownloadWindow);
          logout();
          return;
        }

        if (!res.ok) {
          closePendingDownloadWindow(iosDownloadWindow);
          const err = await res.text();
          console.error("COVER PDF ERROR:", err);
          enableBtn("downloadCoverPdf", "Download Cover Letter");
          return;
        }

        try {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = "Cover_Letter.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();

          setTimeout(() => URL.revokeObjectURL(url), 5000);

          decrementRemainingCount("coverLettersRemaining");
          updateCoverLetterCounter();
        } catch (err) {
          console.error("Download error:", err);
          alert("Download failed");
        }

        enableBtn("downloadCoverPdf", "Download Cover Letter");
      });
    }
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
    await saveCoverLetterDraft(res.letter);
    setStatus("Cover letter ready ✓", "#16a34a");

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

  // 🔥 FORCE SAVE BEFORE DOWNLOAD
  const saved = await saveCV({ silent: true });

  if (!saved) {
    alert("Save failed. Please try again.");
    return;
  }

  disableBtn("downloadPdfBtn", "Processing…");

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ✅ iPhone: skip fetch entirely
  if (isIOS) {
    window.location.href =
      `${window.API_BASE}/api/pdf/cv/${currentCv._id}?token=${token}`;
    enableBtn("downloadPdfBtn", "Download CV (PDF)");
    return;
  }

  let res;

  try {
    res = await fetch(
      `${window.API_BASE}/api/pdf/cv/${currentCv._id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  } catch (err) {
    alert("Network error. Please try again.");
    enableBtn("downloadPdfBtn", "Download CV (PDF)");
    return;
  }

  // 💳 PAYMENT REQUIRED
  if (res.status === 402) {
    enableBtn("downloadPdfBtn", "Pay to download CV");
    window.location.href =
      `pay.html?type=cv&cv=${currentCv._id}`;
    return;
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("PDF ERROR:", err);
    enableBtn("downloadPdfBtn", "Download CV (PDF)");
    return;
  }

  try {

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "CV.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);

  } catch (err) {
    console.error("Download error:", err);
    alert("Download failed");
  }

  enableBtn("downloadPdfBtn", "Download CV (PDF)");
}); 


/* ================= COVER LETTER PDF DOWNLOAD (CV-IDENTICAL) ================= */
document.getElementById("downloadCoverPdf")
?.addEventListener("click", async () => {

  if (!currentCv._id) {
    alert("Please save your CV first");
    return;
  }

  disableBtn("downloadCoverPdf", "Processing…");

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ✅ iPhone: skip fetch entirely
  if (isIOS) {
    window.location.href =
      `${window.API_BASE}/api/pdf/cover-letter/${currentCv._id}?token=${token}`;
    enableBtn("downloadCoverPdf", "Download Cover Letter");
    return;
  }

  let res;

  try {
    res = await fetch(
      `${window.API_BASE}/api/pdf/cover-letter/${currentCv._id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  } catch (err) {
    alert("Network error. Please try again.");
    enableBtn("downloadCoverPdf", "Download Cover Letter");
    return;
  }

  // 💳 PAYMENT REQUIRED
  if (res.status === 402) {
    enableBtn("downloadCoverPdf", "Pay to download Cover Letter");
    window.location.href =
      `pay.html?type=cover-letter&cv=${currentCv._id}`;
    return;
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("COVER PDF ERROR:", err);
    enableBtn("downloadCoverPdf", "Download Cover Letter");
    return;
  }

  try {

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Cover_Letter.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);

  } catch (err) {
    console.error("Download error:", err);
    alert("Download failed");
  }

  enableBtn("downloadCoverPdf", "Download Cover Letter");

});


  attachFixedDownloadHandlers();
  if (!experienceList.children.length) createExperienceBlock();
  if (!educationList.children.length) createEducationBlock();
});
