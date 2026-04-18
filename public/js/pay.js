console.log("PAY.JS LOADED (PAYFAST MODE)");

const user = window.getStoredUser ? window.getStoredUser() : null;
if (!user || !user.token) {
  alert("Please log in first");
  window.location.href = "login.html";
}

const payBtn = document.getElementById("payBtn");
const payError = document.getElementById("payError");

payBtn?.addEventListener("click", async () => {
  try {
    payBtn.disabled = true;
    payBtn.textContent = "Redirecting to PayFast...";

    const cvId = window.PAY_CV_ID;
    const type = window.PAY_TYPE || "cv";
    const next = window.PAY_NEXT || "";

    if (!cvId) {
      throw new Error("Missing CV ID");
    }

    const res = await fetch(`${window.API_BASE}/api/payfast/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`
      },
      body: JSON.stringify({ cvId, type, next })
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.redirectUrl) {
      throw new Error(data.message || "Payment creation failed");
    }

    window.location.href = data.redirectUrl;
  } catch (err) {
    console.error("PAY ERROR:", err);
    payError.textContent = "Payment could not be started. Please try again.";
    payBtn.disabled = false;
    payBtn.textContent = "Pay with PayFast";
  }
});
