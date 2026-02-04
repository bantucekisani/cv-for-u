console.log("💳 PAY.JS LOADED (PAYFAST MODE)");

const user = JSON.parse(localStorage.getItem("user"));
if (!user || !user.token) {
  alert("Please log in first");
  window.location.href = "login.html";
}

const payBtn = document.getElementById("payBtn");
const payError = document.getElementById("payError");

payBtn?.addEventListener("click", async () => {
  try {
    payBtn.disabled = true;
    payBtn.textContent = "Redirecting to PayFast…";

    const cvId = window.PAY_CV_ID;
    const type = window.PAY_TYPE || "cv";

    if (!cvId) {
      throw new Error("Missing CV ID");
    }

    const res = await fetch(
      `${window.API_BASE}/api/payfast/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ cvId, type })
      }
    );

    const data = await res.json();

    if (!data.success || !data.redirectUrl) {
      throw new Error("Payment creation failed");
    }

    // ✅ REDIRECT TO PAYFAST
    window.location.href = data.redirectUrl;

  } catch (err) {
    console.error("❌ PAY ERROR:", err);
    payError.textContent = "Payment could not be started. Please try again.";
    payBtn.disabled = false;
    payBtn.textContent = "Pay with PayFast";
  }
});
