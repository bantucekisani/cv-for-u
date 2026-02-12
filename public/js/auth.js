console.log("AUTH JS LOADED");

/* =====================================================
   AUTH STORAGE HELPERS
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

window.getToken = function () {
  const user = window.getStoredUser();
  return user?.token || null;
};

window.logout = function () {
  localStorage.removeItem("user");
  localStorage.removeItem("lastCvId");
  window.location.href = "login.html";
};

/* =====================================================
   WAIT FOR DOM
===================================================== */
document.addEventListener("DOMContentLoaded", () => {

  // ----------------- SIGNUP -----------------
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullNameEl = document.getElementById("signupFullName");
      const emailEl = document.getElementById("signupEmail");
      const passwordEl = document.getElementById("signupPassword");
      const errorBox = document.getElementById("signupError");

      if (!fullNameEl || !emailEl || !passwordEl || !errorBox) return;

      const fullName = fullNameEl.value.trim();
      const email = emailEl.value.trim();
      const password = passwordEl.value.trim();

      errorBox.textContent = "";

      try {
        const res = await fetch(`${window.API_BASE}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          errorBox.textContent = data.message || "Signup failed";
          return;
        }

        const user = { ...data.user, token: data.token };
        localStorage.setItem("user", JSON.stringify(user));

        window.location.href = "dashboard.html";

      } catch (err) {
        console.error("SIGNUP ERROR:", err);
        errorBox.textContent = "Server error. Try again.";
      }
    });
  }

  // ----------------- LOGIN -----------------
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailEl = document.getElementById("loginEmail");
      const passwordEl = document.getElementById("loginPassword");
      const errorBox = document.getElementById("loginError");

      if (!emailEl || !passwordEl || !errorBox) return;

      const email = emailEl.value.trim();
      const password = passwordEl.value.trim();

      errorBox.textContent = "";

      try {
        const res = await fetch(`${window.API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          errorBox.textContent = data.message || "Invalid login details";
          return;
        }

        const user = { ...data.user, token: data.token };
        localStorage.setItem("user", JSON.stringify(user));

        if (user.role === "admin") window.location.href = "admin.html";
        else window.location.href = "dashboard.html";

      } catch (err) {
        console.error("LOGIN ERROR:", err);
        errorBox.textContent = "Server error. Try again.";
      }
    });
  }

});
