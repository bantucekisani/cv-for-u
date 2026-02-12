console.log("AUTH JS LOADED");

/* =====================================================
   AUTH STORAGE HELPERS (NO TOKEN STORAGE ANYMORE)
===================================================== */
window.getStoredUser = function () {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

window.logout = function () {
  localStorage.removeItem("user");
  localStorage.removeItem("lastCvId");

  // optional: clear cookie by calling logout endpoint later
  window.location.href = "login.html";
};

/* =====================================================
   WAIT FOR DOM
===================================================== */
document.addEventListener("DOMContentLoaded", () => {

  /* ================= SIGNUP ================= */
  const signupForm = document.getElementById("signupForm");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullName = document.getElementById("signupFullName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value.trim();
      const errorBox = document.getElementById("signupError");

      errorBox.textContent = "";

      try {
        const res = await fetch(`${window.API_BASE}/api/auth/signup`, {
          method: "POST",
          credentials: "include",  // 🔥 REQUIRED
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          errorBox.textContent = data.message || "Signup failed";
          return;
        }

        // 🔥 SAVE USER ONLY (NO TOKEN)
        localStorage.setItem("user", JSON.stringify(data.user));

        window.location.href = "dashboard.html";

      } catch (err) {
        console.error("SIGNUP ERROR:", err);
        errorBox.textContent = "Server error. Try again.";
      }
    });
  }

  /* ================= LOGIN ================= */
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value.trim();
      const errorBox = document.getElementById("loginError");

      errorBox.textContent = "";

      try {
        const res = await fetch(`${window.API_BASE}/api/auth/login`, {
          method: "POST",
          credentials: "include",  // 🔥 REQUIRED
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          errorBox.textContent = data.message || "Invalid login details";
          return;
        }

        // 🔥 SAVE USER ONLY (NO TOKEN)
        localStorage.setItem("user", JSON.stringify(data.user));

        if (data.user.role === "admin")
          window.location.href = "admin.html";
        else
          window.location.href = "dashboard.html";

      } catch (err) {
        console.error("LOGIN ERROR:", err);
        errorBox.textContent = "Server error. Try again.";
      }
    });
  }

});
