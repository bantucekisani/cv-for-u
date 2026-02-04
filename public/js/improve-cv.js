// js/improve-cv.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://192.168.101.251:5000"; // adjust if needed

  const cvInput = document.getElementById("cvInput");
  const cvTone = document.getElementById("cvTone");
  const improveBtn = document.getElementById("improveBtn");
  const statusEl = document.getElementById("improveStatus");
  const improvedOutput = document.getElementById("improvedOutput");
  const copyBtn = document.getElementById("copyBtn");

  improveBtn.addEventListener("click", async () => {
    const text = cvInput.value.trim();
    const tone = cvTone.value;

    if (!text) {
      alert("Please paste your CV text first.");
      return;
    }

    improveBtn.disabled = true;
    improveBtn.textContent = "Improving...";
    statusEl.textContent = "Sending your CV to CV for U AI...";
    copyBtn.disabled = true;
    improvedOutput.innerHTML = "";

    try {
      const res = await fetch(`${API_BASE}/api/cv/improve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text, tone })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.message || "AI error");

      improvedOutput.textContent = data.improvedText;
      statusEl.textContent = "Done ✔ You can copy or edit the improved version.";
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

  copyBtn.addEventListener("click", () => {
    const text = improvedOutput.textContent.trim();
    if (!text) return;

    navigator.clipboard.writeText(text)
      .then(() => {
        statusEl.textContent = "Improved CV copied to clipboard ✅";
      })
      .catch(() => {
        alert("Could not copy text. Please copy manually.");
      });
  });
});
