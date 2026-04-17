console.log("AUTH JS LOADED");

window.getStoredUser = function () {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

window.getToken = function () {
  return window.getStoredUser()?.token || null;
};

window.storeUserSession = function (data) {
  const user = { ...data.user, token: data.token };
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("token", data.token);
  return user;
};

window.clearUserSession = function () {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("lastCvId");
};

window.logout = function () {
  window.clearUserSession();
  window.location.href = "login.html";
};

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({
    success: false,
    message: "Unexpected server response"
  }));

  return { res, data };
}

function setMessage(element, message, type = "error") {
  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.classList.remove("success", "error");
  if (message) {
    element.classList.add(type);
  }
}

function setupPasswordToggles() {
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  passwordInputs.forEach((input, index) => {
    if (input.dataset.passwordToggleReady === "true") {
      return;
    }

    input.dataset.passwordToggleReady = "true";
    input.classList.add("password-toggle-input");

    if (!input.id) {
      input.id = `passwordField${index + 1}`;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle-btn";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-controls", input.id);
    toggle.setAttribute("aria-label", "Show password");
    toggle.setAttribute("aria-pressed", "false");

    toggle.addEventListener("click", () => {
      const nextType = input.type === "password" ? "text" : "password";
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const hadFocus = document.activeElement === input;

      input.type = nextType;

      const isVisible = nextType === "text";
      toggle.textContent = isVisible ? "Hide" : "Show";
      toggle.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(isVisible));

      if (hadFocus) {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
        if (selectionStart !== null && selectionEnd !== null) {
          try {
            input.setSelectionRange(selectionStart, selectionEnd);
          } catch {}
        }
      }
    });

    wrapper.appendChild(toggle);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullName = document.getElementById("signupFullName")?.value.trim() || "";
      const username = document.getElementById("signupUsername")?.value.trim() || "";
      const email = document.getElementById("signupEmail")?.value.trim() || "";
      const password = document.getElementById("signupPassword")?.value || "";
      const confirmPassword = document.getElementById("signupConfirmPassword")?.value || "";
      const errorBox = document.getElementById("signupError");

      setMessage(errorBox, "");

      if (password !== confirmPassword) {
        setMessage(errorBox, "Passwords do not match");
        return;
      }

      try {
        const { res, data } = await postJson(`${window.API_BASE}/api/auth/signup`, {
          fullName,
          username,
          email,
          password,
          confirmPassword
        });

        if (!res.ok || !data.success) {
          setMessage(errorBox, data.message || "Signup failed");
          return;
        }

        window.storeUserSession(data);
        window.location.href = "dashboard.html";
      } catch (err) {
        console.error("SIGNUP ERROR:", err);
        setMessage(errorBox, "Server error. Try again.");
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const identifier = document.getElementById("loginIdentifier")?.value.trim() || "";
      const password = document.getElementById("loginPassword")?.value || "";
      const errorBox = document.getElementById("loginError");

      setMessage(errorBox, "");

      try {
        const { res, data } = await postJson(`${window.API_BASE}/api/auth/login`, {
          identifier,
          password
        });

        if (!res.ok || !data.success) {
          setMessage(errorBox, data.message || "Invalid login details");
          return;
        }

        const user = window.storeUserSession(data);
        window.location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
      } catch (err) {
        console.error("LOGIN ERROR:", err);
        setMessage(errorBox, "Server error. Try again.");
      }
    });
  }

  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const identifier = document.getElementById("forgotIdentifier")?.value.trim() || "";
      const messageBox = document.getElementById("forgotMessage");
      const debugBox = document.getElementById("forgotDebug");

      setMessage(messageBox, "");
      if (debugBox) {
        debugBox.innerHTML = "";
      }

      try {
        const { res, data } = await postJson(`${window.API_BASE}/api/auth/forgot-password`, {
          identifier
        });

        if (debugBox && data.resetUrl) {
          debugBox.innerHTML = `<a href="${data.resetUrl}">Open reset link</a>`;
        }

        if (!res.ok || !data.success) {
          setMessage(messageBox, data.message || "Could not send reset link");
          return;
        }

        setMessage(
          messageBox,
          data.message || "If an account exists, a reset link has been sent. Check your inbox and spam folder.",
          "success"
        );
      } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        setMessage(messageBox, "Server error. Try again.");
      }
    });
  }

  const resetForm = document.getElementById("resetPasswordForm");
  if (resetForm) {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    const messageBox = document.getElementById("resetMessage");
    const submitBtn = document.getElementById("resetPasswordBtn");

    if (!token) {
      setMessage(messageBox, "This reset link is invalid.");
      if (submitBtn) {
        submitBtn.disabled = true;
      }
    } else {
      fetch(`${window.API_BASE}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({ success: false }));
          if (!res.ok || !data.success) {
            setMessage(messageBox, data.message || "This reset link is invalid or expired.");
            if (submitBtn) {
              submitBtn.disabled = true;
            }
          }
        })
        .catch(() => {
          setMessage(messageBox, "Could not validate reset link.");
          if (submitBtn) {
            submitBtn.disabled = true;
          }
        });
    }

    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const password = document.getElementById("resetPassword")?.value || "";
      const confirmPassword = document.getElementById("resetConfirmPassword")?.value || "";

      setMessage(messageBox, "");

      if (password !== confirmPassword) {
        setMessage(messageBox, "Passwords do not match");
        return;
      }

      try {
        const { res, data } = await postJson(`${window.API_BASE}/api/auth/reset-password`, {
          token,
          password,
          confirmPassword
        });

        if (!res.ok || !data.success) {
          setMessage(messageBox, data.message || "Could not reset password");
          return;
        }

        window.storeUserSession(data);
        setMessage(messageBox, "Password reset successful. Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1200);
      } catch (err) {
        console.error("RESET PASSWORD ERROR:", err);
        setMessage(messageBox, "Server error. Try again.");
      }
    });
  }
});
