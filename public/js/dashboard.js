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
        <h3>${cv.cvName || cv.name || "Untitled CV"}</h3>

        <p class="cv-date">
          Updated: ${new Date(cv.updatedAt).toLocaleString()}
        </p>

        <div class="cv-actions">
          <button class="small-btn edit-btn" data-id="${cv._id}">Edit</button>
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
