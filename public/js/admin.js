(async () => {
  const token = getToken();
  if (!token) return logout();

  try {
    /* ======================
       STATS
    ====================== */
    const statsRes = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!statsRes.ok) throw new Error("Stats failed");

    const statsJson = await statsRes.json();
    const stats = statsJson.stats || {};

    document.getElementById("statUsers").textContent = stats.users ?? 0;
    document.getElementById("statCVs").textContent = stats.cvs ?? 0;
    document.getElementById("statPaid").textContent = stats.paidCVs ?? 0;

    const revenue = Number(stats.revenue || 0);
    document.getElementById("statRevenue").textContent =
      `R${revenue.toFixed(2)}`;

    /* ======================
       USERS
    ====================== */
    const usersRes = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!usersRes.ok) throw new Error("Users failed");

    const usersData = await usersRes.json();
    const usersTable = document.getElementById("usersTable");
    usersTable.innerHTML = "";

    (usersData.users || []).forEach(u => {
      usersTable.innerHTML += `
        <tr>
          <td>${u.fullName || "—"}</td>
          <td>${u.email || "—"}</td>
          <td>
            <span class="role-badge ${
              u.role === "admin" ? "role-admin" : "role-user"
            }">${u.role || "user"}</span>
          </td>
          <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
        </tr>
      `;
    });

    /* ======================
       PAYMENTS
    ====================== */
    const payRes = await fetch(`${API_BASE}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (payRes.ok) {
      const payData = await payRes.json();
      const tbody = document.getElementById("paymentsTable");
      tbody.innerHTML = "";

      (payData.payments || []).forEach(p => {
        const amount = Number(p.amount || 0);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.userId?.fullName || "—"}</td>
          <td>${p.userId?.email || "—"}</td>
          <td>${p.type || "—"}</td>
          <td>R${amount.toFixed(2)}</td>
          <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    /* ======================
       REVENUE (DAY / MONTH)
    ====================== */
    const revRes = await fetch(`${API_BASE}/api/admin/revenue`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!revRes.ok) throw new Error("Revenue failed");

    const revData = await revRes.json();

    const daily = document.getElementById("dailyRevenue");
    daily.innerHTML = "";

    Object.entries(revData.daily || {}).forEach(([day, amount]) => {
      daily.innerHTML += `<li>${day}: R${Number(amount).toFixed(2)}</li>`;
    });

    const monthly = document.getElementById("monthlyRevenue");
    monthly.innerHTML = "";

    Object.entries(revData.monthly || {}).forEach(([month, amount]) => {
      monthly.innerHTML += `<li>${month}: R${Number(amount).toFixed(2)}</li>`;
    });

  } catch (err) {
    console.error("ADMIN DASHBOARD ERROR:", err);
    alert("Failed to load admin dashboard");
  }
})();
