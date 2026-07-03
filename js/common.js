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

// 按股票代码聚合持仓：累计买卖量、加权均价、状态、盈亏
// 盈亏 = (加权卖出均价 - 加权买入均价) × 已卖数量，仅当该股票既有买入又有卖出时计算
export function aggregatePositions(transactions) {
  const map = new Map();
  for (const t of transactions || []) {
    const code = t.stock_code;
    if (!map.has(code)) {
      map.set(code, {
        stock_code: code,
        stock_name: t.stock_name || "",
        buy_qty: 0, sell_qty: 0,
        buy_value: 0, sell_value: 0,
      });
    }
    const p = map.get(code);
    const bq = Number(t.buy_quantity) || 0;
    const sq = Number(t.sell_quantity) || 0;
    if (bq > 0) { p.buy_qty += bq; p.buy_value += (Number(t.buy_price) || 0) * bq; }
    if (sq > 0) { p.sell_qty += sq; p.sell_value += (Number(t.sell_price) || 0) * sq; }
  }
  const rows = [];
  for (const p of map.values()) {
    const avg_buy = p.buy_qty > 0 ? p.buy_value / p.buy_qty : 0;
    const avg_sell = p.sell_qty > 0 ? p.sell_value / p.sell_qty : 0;
    let status = "持仓中";
    let pnl = null;
    if (p.buy_qty > 0 && p.sell_qty > 0) {
      // 有买有卖：已卖部分按加权均价算盈亏
      pnl = (avg_sell - avg_buy) * p.sell_qty;
      status = p.sell_qty >= p.buy_qty ? "已清仓" : "持仓中";
    }
    rows.push({ ...p, avg_buy, avg_sell, status, pnl });
  }
  return rows;
}

// 盈亏展示：返回 {text, cls}，盈利用 .up（红），亏损用 .down（绿）
export function formatPnl(v) {
  if (v == null) return { text: "—", cls: "muted" };
  const sign = v >= 0 ? "+" : "-";
  const abs = Math.abs(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: sign + "¥" + abs, cls: v >= 0 ? "up" : "down" };
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
