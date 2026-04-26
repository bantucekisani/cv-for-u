/* ======================================
   DASHBOARD.JS – FINAL FIX (PHONE + PC)
   CV for U
====================================== */

/* =====================================================
   API BASE — DEV (PC + PHONE) / PROD READY
===================================================== */
// USE GLOBAL API_BASE ONLY
const API = `${window.API_BASE}/api/cv`;



const user = JSON.parse(localStorage.getItem("user"));
const token = user?.token;

if (!token) {
  window.location.href = "login.html";
}


/* ======================================
   LOGOUT
====================================== */

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "login.html";
});

/* ======================================
   ELEMENTS
====================================== */

const cvList = document.getElementById("cvList");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function neutralizeJobFinderCopy(text = "", candidateName = "") {
  let output = String(text || "").trim();
  const fullName = String(candidateName || "").trim();

  if (!output || !fullName) {
    return output;
  }

  const escapeRegex = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedFullName = escapeRegex(fullName);
  const firstName = escapeRegex(fullName.split(/\s+/)[0] || "");

  if (escapedFullName) {
    output = output.replace(new RegExp(`\\b${escapedFullName}'s\\b`, "gi"), "this CV's");
    output = output.replace(new RegExp(`\\b${escapedFullName}\\b`, "gi"), "This CV");
  }

  if (firstName && firstName.length >= 3) {
    output = output.replace(
      new RegExp(`(^|[.!?]\\s+|\\n+)${firstName}\\b`, "gi"),
      (_, prefix) => `${prefix}This CV`
    );
    output = output.replace(new RegExp(`\\b${firstName}'s\\b`, "gi"), "this CV's");
  }

  return output;
}

function buildJobFinderSummary(cv) {
  const searches = Array.isArray(cv.jobSearches) ? cv.jobSearches : [];
  const latest = searches[0] || null;
  const topRole = latest?.targetRoles?.[0] || null;
  const candidateName = cv.name || "";
  const remaining = Math.max(0, Number(cv.jobFinderUsesRemaining || 0));
  const remainingLine = cv.isPaid === true
    ? `<p>Find Me a Job searches left: ${remaining}</p>`
    : "<p>Pay for this CV to unlock 4 Find Me a Job searches.</p>";

  if (!latest || !topRole) {
    return `
      <div class="cv-job-match cv-job-match-empty">
        <p>No saved job searches yet.</p>
        ${remainingLine}
      </div>
    `;
  }

  const safeTitle = escapeHtml(topRole.roleTitle || "Latest role");
  const safeVerdict = escapeHtml(
    neutralizeJobFinderCopy(topRole.whyFit || latest.profileSummary || "Job finder ready", candidateName)
  );
  const safeDate = latest.createdAt
    ? escapeHtml(new Date(latest.createdAt).toLocaleString())
    : "";

  return `
    <div class="cv-job-match">
      <p><strong>Latest search plan:</strong> ${Number(topRole.matchScore || 0)}% fit for ${safeTitle}</p>
      <p>${safeVerdict}${safeDate ? ` | ${safeDate}` : ""}</p>
      <p>Saved searches: ${searches.length}</p>
      ${remainingLine}
    </div>
  `;
}

function getJobFinderButtonLabel(cv) {
  const remaining = Math.max(0, Number(cv.jobFinderUsesRemaining || 0));

  if (cv.isPaid !== true) {
    return "Unlock Job Finder";
  }

  if (remaining > 0) {
    return `Find Jobs (${remaining} left)`;
  }

  return "Buy 4 More Searches";
}

/* ======================================
   LOAD USER CVs
====================================== */

async function loadCVs() {
  try {
    const res = await fetch(`${API}/my-cvs`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    cvList.innerHTML = "";

    if (!data.success || !Array.isArray(data.cvs) || data.cvs.length === 0) {
      cvList.innerHTML = `
        <p class="empty-msg">You have no saved CVs yet.</p>
      `;
      return;
    }

    data.cvs.forEach(cv => {
      const card = document.createElement("div");
      card.className = "cv-card";

      card.innerHTML = `
        <h3>${escapeHtml(cv.cvName || cv.name || "Untitled CV")}</h3>

        <p class="cv-date">
          Updated: ${escapeHtml(new Date(cv.updatedAt).toLocaleString())}
        </p>

        ${buildJobFinderSummary(cv)}

        <div class="cv-actions">
          <button class="small-btn edit-btn" data-id="${cv._id}">Edit</button>
          <button
            class="small-btn match-btn"
            data-id="${cv._id}"
            data-paid="${cv.isPaid === true}"
            data-job-finder-remaining="${Math.max(0, Number(cv.jobFinderUsesRemaining || 0))}"
          >${getJobFinderButtonLabel(cv)}</button>
          <button class="small-btn rename-btn" data-id="${cv._id}">Rename</button>
          <button class="small-btn duplicate-btn" data-id="${cv._id}">Duplicate</button>
          <button class="small-btn danger-small delete-btn" data-id="${cv._id}">Delete</button>
        </div>
      `;

      cvList.appendChild(card);
    });

  } catch (err) {
    console.error("LOAD CVS ERROR:", err);
    cvList.innerHTML = `
      <p class="empty-msg error">Failed to load CVs.</p>
    `;
  }
}

/* ======================================
   BUTTON HANDLERS
====================================== */

document.addEventListener("click", async (e) => {

  /* EDIT */
  const editBtn = e.target.closest(".edit-btn");
  if (editBtn) {
    window.location.href = `create-cv.html?id=${editBtn.dataset.id}`;
    return;
  }

  /* JOB MATCH */
  const matchBtn = e.target.closest(".match-btn");
  if (matchBtn) {
    const cvId = matchBtn.dataset.id;
    const isPaid = matchBtn.dataset.paid === "true";
    const remaining = Math.max(0, Number(matchBtn.dataset.jobFinderRemaining || 0));

    if (!isPaid) {
      window.location.href = `pay.html?type=cv&cv=${cvId}&next=job-finder`;
      return;
    }

    if (remaining <= 0) {
      window.location.href = `pay.html?type=job-finder&cv=${cvId}`;
      return;
    }

    window.location.href = `create-cv.html?id=${cvId}&openJobFinder=1`;
    return;
  }

  /* RENAME */
  const renameBtn = e.target.closest(".rename-btn");
  if (renameBtn) {
    const id = renameBtn.dataset.id;
    const name = prompt("Enter new CV name:");
    if (!name) return;

    await fetch(`${API}/rename/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    loadCVs();
    return;
  }

  /* DUPLICATE */
  const duplicateBtn = e.target.closest(".duplicate-btn");
  if (duplicateBtn) {
    await fetch(`${API}/duplicate/${duplicateBtn.dataset.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    loadCVs();
    return;
  }

  /* DELETE */
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    if (!confirm("Delete this CV permanently?")) return;

    await fetch(`${API}/${deleteBtn.dataset.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    loadCVs();
  }
});

/* ======================================
   CREATE NEW CV
====================================== */

document.getElementById("createNewBtn")?.addEventListener("click", () => {
  window.location.href = "create-cv.html";
});

/* ======================================
   INIT
====================================== */

loadCVs();
