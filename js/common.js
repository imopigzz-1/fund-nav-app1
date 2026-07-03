import { Chart, registerables } from "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/+esm";
Chart.register(...registerables);

// ---------- 格式化 ----------
export function formatMoney(v) {
  return "¥" + Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatNav(v) {
  return Number(v).toFixed(4);
}
export function formatPct(v) {
  const pct = v * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}
export function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ---------- 曲线图渲染 ----------
// data: daily_nav 行数组；initial: 初始仓位；range: 7/30/90/"all"
export function renderNavChart(canvasId, data, initial, range, existingChart) {
  let rows = (data || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (range !== "all" && typeof range === "number") {
    rows = rows.slice(-range);
  }
  const labels = rows.map((r) => r.date);
  const navs = rows.map((r) => Number(r.position_value) / initial);

  if (existingChart) existingChart.destroy();

  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "单股净值",
          data: navs,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.08)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: "基准线 (1.0000)",
          data: labels.map(() => 1),
          borderColor: "rgba(148,163,184,0.6)",
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const prev = ctx.dataIndex > 0 ? navs[ctx.dataIndex - 1] : null;
                const change = prev ? (navs[ctx.dataIndex] - prev) / prev : 0;
                const pct = prev ? "  (" + formatPct(change) + ")" : "";
                return `净值: ${formatNav(ctx.parsed.y)}${pct}`;
              }
              return "基准: 1.0000";
            },
          },
        },
      },
      scales: {
        y: {
          ticks: { callback: (v) => Number(v).toFixed(3) },
        },
      },
    },
  });
}
