(function () {
  const storedUser = window.getStoredUser?.() || null;
  const token = getToken();

  if (!token) {
    logout();
    return;
  }

  if (storedUser?.role && storedUser.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const defaultFilters = {
    type: "all",
    from: "",
    to: "",
    limit: "50"
  };

  const state = {
    filters: { ...defaultFilters }
  };

  const $ = id => document.getElementById(id);

  function formatCount(value) {
    return Number(value || 0).toLocaleString("en-ZA");
  }

  function formatCurrency(value) {
    return `R${Number(value || 0).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDayLabel(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      timeZone: "UTC"
    });
  }

  function formatMonthLabel(value) {
    if (!value) return "";
    const date = new Date(`${value}-01T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-ZA", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function setMetric(id, value, formatter = formatCount) {
    const element = $(id);
    if (element) {
      element.textContent = formatter(value);
    }
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    if (response.status === 403) {
      window.location.href = "dashboard.html";
      throw new Error("Admin access only");
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  function buildQuery(filters) {
    const params = new URLSearchParams();

    if (filters.type && filters.type !== "all") {
      params.set("type", filters.type);
    }

    if (filters.from) {
      params.set("from", filters.from);
    }

    if (filters.to) {
      params.set("to", filters.to);
    }

    params.set("limit", String(filters.limit || defaultFilters.limit));
    return params.toString();
  }

  function syncFilterInputs(filters) {
    $("filterType").value = filters.type || defaultFilters.type;
    $("filterFrom").value = filters.from || "";
    $("filterTo").value = filters.to || "";
    $("filterLimit").value = String(filters.limit || defaultFilters.limit);
  }

  function getFilterValues() {
    return {
      type: $("filterType").value || defaultFilters.type,
      from: $("filterFrom").value || "",
      to: $("filterTo").value || "",
      limit: $("filterLimit").value || defaultFilters.limit
    };
  }

  function renderBarChart(containerId, data, options = {}) {
    const container = $(containerId);
    if (!container) return;

    const {
      valueKey = "amount",
      emptyText = "No data available yet.",
      valueFormatter = formatCurrency,
      labelFormatter = value => value
    } = options;

    container.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<div class="chart-empty">${emptyText}</div>`;
      return;
    }

    const values = data.map(item => Number(item[valueKey] || 0));
    const maxValue = Math.max(...values, 0);

    if (maxValue <= 0) {
      container.innerHTML = `<div class="chart-empty">${emptyText}</div>`;
      return;
    }

    data.forEach(item => {
      const value = Number(item[valueKey] || 0);
      const column = document.createElement("div");
      column.className = "chart-col";

      const valueEl = document.createElement("div");
      valueEl.className = "chart-value";
      valueEl.textContent = valueFormatter(value);

      const track = document.createElement("div");
      track.className = "chart-track";

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.style.height = `${Math.max((value / maxValue) * 100, 8)}%`;
      bar.title = `${labelFormatter(item.label)}: ${valueFormatter(value)}`;
      track.appendChild(bar);

      const labelEl = document.createElement("div");
      labelEl.className = "chart-label";
      labelEl.textContent = labelFormatter(item.label);

      column.appendChild(valueEl);
      column.appendChild(track);
      column.appendChild(labelEl);
      container.appendChild(column);
    });
  }

  function renderPaymentTypeBreakdown(items = []) {
    const container = $("paymentTypeBreakdown");
    if (!container) return;

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = '<div class="chart-empty">No revenue recorded yet.</div>';
      return;
    }

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    items.forEach(item => {
      const share = totalAmount > 0
        ? Math.round((Number(item.amount || 0) / totalAmount) * 100)
        : 0;

      const row = document.createElement("div");
      row.className = "type-row";

      const head = document.createElement("div");
      head.className = "type-head";

      const title = document.createElement("div");
      title.className = "type-title";
      title.textContent = item.label || item.type || "Payment";

      const amount = document.createElement("div");
      amount.className = "type-amount";
      amount.textContent = formatCurrency(item.amount);

      head.appendChild(title);
      head.appendChild(amount);

      const meter = document.createElement("div");
      meter.className = "type-meter";

      const fill = document.createElement("div");
      fill.className = "type-fill";
      fill.style.width = `${share}%`;
      meter.appendChild(fill);

      const foot = document.createElement("div");
      foot.className = "type-foot";
      foot.textContent = `${formatCount(item.count)} payments • ${share}% of revenue`;

      row.appendChild(head);
      row.appendChild(meter);
      row.appendChild(foot);
      container.appendChild(row);
    });
  }

  function renderUsers(users = []) {
    const tbody = $("usersTable");
    const empty = $("usersEmpty");
    if (!tbody || !empty) return;

    tbody.innerHTML = "";

    if (!users.length) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    users.forEach(user => {
      const row = document.createElement("tr");

      row.appendChild(createCell(user.fullName || "-"));
      row.appendChild(createCell(user.email || "-"));

      const roleCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `role-badge ${user.role === "admin" ? "role-admin" : "role-user"}`;
      badge.textContent = user.role || "user";
      roleCell.appendChild(badge);
      row.appendChild(roleCell);

      row.appendChild(createCell(formatDate(user.createdAt)));

      tbody.appendChild(row);
    });
  }

  function paymentBadgeClass(type) {
    const classMap = {
      cv: "payment-cv",
      "cover-letter": "payment-cover-letter",
      "job-finder": "payment-job-finder"
    };

    return classMap[type] || "payment-cv";
  }

  function paymentLabel(type) {
    const labelMap = {
      cv: "CV",
      "cover-letter": "Cover Letter",
      "job-finder": "Find Me a Job"
    };

    return labelMap[type] || "CV";
  }

  function renderPayments(payments = []) {
    const tbody = $("paymentsTable");
    const empty = $("paymentsEmpty");
    if (!tbody || !empty) return;

    tbody.innerHTML = "";

    if (!payments.length) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    payments.forEach(payment => {
      const row = document.createElement("tr");

      row.appendChild(createCell(payment.userId?.fullName || "-"));
      row.appendChild(createCell(payment.userId?.email || "-"));

      const typeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `payment-badge ${paymentBadgeClass(payment.type)}`;
      badge.textContent = paymentLabel(payment.type);
      typeCell.appendChild(badge);
      row.appendChild(typeCell);

      row.appendChild(createCell(formatCurrency(payment.amount)));
      row.appendChild(createCell(payment.provider || "payfast"));
      row.appendChild(createCell(formatDateTime(payment.createdAt)));

      tbody.appendChild(row);
    });
  }

  function updateLastUpdated() {
    const element = $("lastUpdated");
    if (!element) return;

    element.textContent = `Last updated ${new Date().toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }

  function renderOverview(overview) {
    const metrics = overview?.metrics || {};
    const trends = overview?.trends || {};

    setMetric("statUsers", metrics.users);
    setMetric("statUsersThisMonth", metrics.usersThisMonth);
    setMetric("statCVs", metrics.cvs);
    setMetric("statPaid", metrics.paidCVs);
    setMetric("statRevenue", metrics.revenue, formatCurrency);
    setMetric("statRevenueToday", metrics.revenueToday, formatCurrency);
    setMetric("statRevenueMonth", metrics.revenueThisMonth, formatCurrency);
    setMetric("statAverageOrder", metrics.averageOrderValue, formatCurrency);

    renderBarChart("revenueDayChart", trends.revenueByDay, {
      valueKey: "amount",
      labelFormatter: formatDayLabel,
      valueFormatter: formatCurrency,
      emptyText: "No revenue has been recorded in the last 14 days."
    });

    renderBarChart("revenueMonthChart", trends.revenueByMonth, {
      valueKey: "amount",
      labelFormatter: formatMonthLabel,
      valueFormatter: formatCurrency,
      emptyText: "No monthly revenue data yet."
    });

    renderBarChart("userGrowthChart", trends.usersByMonth, {
      valueKey: "count",
      labelFormatter: formatMonthLabel,
      valueFormatter: formatCount,
      emptyText: "No user growth data yet."
    });

    renderPaymentTypeBreakdown(overview?.paymentTypes || []);
    renderUsers(overview?.recentUsers || []);

    const revenueDayTotal = (trends.revenueByDay || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const revenueMonthTotal = (trends.revenueByMonth || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const userGrowthTotal = (trends.usersByMonth || []).reduce(
      (sum, item) => sum + Number(item.count || 0),
      0
    );

    $("revenueDayMeta").textContent = `${formatCurrency(revenueDayTotal)} total over 14 days`;
    $("revenueMonthMeta").textContent = `${formatCurrency(revenueMonthTotal)} across 6 months`;
    $("userGrowthMeta").textContent = `${formatCount(userGrowthTotal)} new users across 6 months`;
  }

  function renderPaymentSummary(summary = {}) {
    setMetric("paymentsRevenue", summary.revenue, formatCurrency);
    setMetric("paymentsCount", summary.count);
    setMetric("paymentsCvCount", summary.cvCount);
    setMetric("paymentsCoverCount", summary.coverLetterCount);
    setMetric("paymentsJobFinderCount", summary.jobFinderCount);
  }

  async function loadOverview() {
    const data = await fetchJson(`${API_BASE}/api/admin/overview`);
    if (!data) return;
    renderOverview(data.overview || {});
  }

  async function loadPayments() {
    const query = buildQuery(state.filters);
    const data = await fetchJson(`${API_BASE}/api/admin/payments?${query}`);
    if (!data) return;

    renderPaymentSummary(data.summary || {});
    renderPayments(data.payments || []);
  }

  async function exportPayments() {
    const button = $("exportPaymentsBtn");
    const originalText = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Exporting...";

      const query = buildQuery(state.filters);
      const response = await fetch(`${API_BASE}/api/admin/payments/export?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.status === 403) {
        window.location.href = "dashboard.html";
        return;
      }

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "admin-payments.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function refreshDashboard() {
    await Promise.all([loadOverview(), loadPayments()]);
    updateLastUpdated();
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncFilterInputs(state.filters);

    $("paymentFilters")?.addEventListener("submit", async event => {
      event.preventDefault();
      state.filters = getFilterValues();
      await loadPayments();
      updateLastUpdated();
    });

    $("resetFilters")?.addEventListener("click", async () => {
      state.filters = { ...defaultFilters };
      syncFilterInputs(state.filters);
      await loadPayments();
      updateLastUpdated();
    });

    $("exportPaymentsBtn")?.addEventListener("click", async () => {
      try {
        await exportPayments();
      } catch (err) {
        console.error("ADMIN EXPORT ERROR:", err);
        alert("Could not export payments right now.");
      }
    });

    refreshDashboard().catch(err => {
      console.error("ADMIN DASHBOARD ERROR:", err);
      alert("Failed to load admin dashboard.");
    });
  });
})();
