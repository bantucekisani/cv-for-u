document.addEventListener("DOMContentLoaded", () => {
  document.title = "CV for U - Improve My CV";

  const logo = document.querySelector(".logo");
  if (logo) {
    logo.src = "images/logo.png";
  }

  const appName = document.querySelector(".app-name");
  if (appName) {
    appName.textContent = "CV for U";
  }

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const token = storedUser?.token || null;

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const cvInput = document.getElementById("cvInput");
  const cvTone = document.getElementById("cvTone");
  const improveBtn = document.getElementById("improveBtn");
  const statusEl = document.getElementById("improveStatus");
  const improvedOutput = document.getElementById("improvedOutput");
  const copyBtn = document.getElementById("copyBtn");

  improveBtn?.addEventListener("click", async () => {
    const text = cvInput.value.trim();
    const tone = cvTone.value;

    if (!text) {
      alert("Please paste your CV text first.");
      return;
    }

    improveBtn.disabled = true;
    improveBtn.textContent = "Improving...";
    copyBtn.disabled = true;
    statusEl.textContent = "CV for U AI is improving your CV...";
    improvedOutput.textContent = "";

    try {
      const res = await fetch("/api/ai/improve-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text, tone })
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("user");
        localStorage.removeItem("lastCvId");
        window.location.href = "login.html";
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success || !data.improvedText) {
        throw new Error(data.msg || data.message || `HTTP ${res.status}`);
      }

      improvedOutput.textContent = data.improvedText;
      statusEl.textContent = "Improved CV ready. You can copy and refine it.";
      copyBtn.disabled = false;
    } catch (err) {
      console.error("Improve error:", err);
      statusEl.textContent = "Something went wrong while improving your CV.";
      alert("Failed to improve your CV. Please try again.");
    } finally {
      improveBtn.disabled = false;
      improveBtn.textContent = "Improve my CV";
    }
  });

  copyBtn?.addEventListener("click", async () => {
    const text = improvedOutput.textContent.trim();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "Improved CV copied to clipboard.";
    } catch {
      alert("Could not copy text. Please copy manually.");
    }
  });
});
