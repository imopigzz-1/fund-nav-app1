import { supabase } from "./supabase.js";
import { requireAuth, signOut } from "./auth.js";
import { renderNavChart, formatMoney, formatNav, formatPct } from "./common.js";

const user = await requireAuth();
if (!user) throw new Error("unauthorized");

document.getElementById("userName").textContent = `· ${user.profile.username || ""}`;
document.getElementById("logoutBtn").addEventListener("click", signOut);

let currentRange = 30;
let allNav = [];
let initial = null;
let navChart = null;

async function loadAll() {
  // 初始仓位
  const { data: cfg } = await supabase.from("fund_config").select("*").eq("id", 1).maybeSingle();
  initial = cfg ? Number(cfg.initial_position) : null;

  // 全部净值
  const { data: navRows } = await supabase.from("daily_nav").select("*").order("date");
  allNav = (navRows || []).sort((a, b) => a.date.localeCompare(b.date));

  document.getElementById("initPos").textContent = initial ? formatMoney(initial) : "—";
  renderLatest();
  renderChart();
  renderNavTable();
  await renderTransactions();
}

function renderLatest() {
  if (!allNav.length || !initial) {
    document.getElementById("latestNav").textContent = "—";
    document.getElementById("latestDate").textContent = "暂无数据";
    return;
  }
  const last = allNav[allNav.length - 1];
  const nav = Number(last.position_value) / initial;
  document.getElementById("latestNav").textContent = formatNav(nav);
  document.getElementById("latestDate").textContent = last.date;

  const changeEl = document.getElementById("latestChange");
  if (allNav.length >= 2) {
    const prev = Number(allNav[allNav.length - 2].position_value) / initial;
    const change = (nav - prev) / prev;
    changeEl.textContent = formatPct(change);
    changeEl.className = "nav-change " + (change >= 0 ? "up" : "down");
  } else {
    changeEl.textContent = "首日";
  }
}

function renderChart() {
  navChart = renderNavChart("navChart", allNav, initial, currentRange, navChart);
}

function renderNavTable() {
  const body = document.getElementById("navTableBody");
  body.innerHTML = "";
  if (!initial) { body.innerHTML = `<tr><td colspan="4" class="empty-row">暂无数据</td></tr>`; return; }
  const rows = allNav.slice().reverse();
  const reversedAsc = allNav.slice();
  rows.forEach((r, idx) => {
    const nav = Number(r.position_value) / initial;
    const origIdx = reversedAsc.length - 1 - idx;
    let changeText = "—";
    let cls = "";
    if (origIdx > 0) {
      const prev = Number(reversedAsc[origIdx - 1].position_value) / initial;
      const change = (nav - prev) / prev;
      changeText = formatPct(change);
      cls = change >= 0 ? "up" : "down";
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${formatMoney(r.position_value)}</td>
      <td>${formatNav(nav)}</td>
      <td class="${cls}">${changeText}</td>`;
    body.appendChild(tr);
  });
}

async function renderTransactions() {
  const { data: txs } = await supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at");
  const wrap = document.getElementById("txGrouped");
  wrap.innerHTML = "";
  if (!txs || txs.length === 0) {
    wrap.innerHTML = `<p class="muted">暂无操作记录</p>`;
    return;
  }
  // 按日期分组
  const groups = {};
  txs.forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
  for (const date of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    const block = document.createElement("div");
    block.className = "tx-group";
    let rows = groups[date].map((t) => `
      <tr>
        <td>${t.stock_code}</td><td>${t.stock_name}</td>
        <td>${t.buy_price ?? "—"}</td><td>${t.buy_quantity ?? "—"}</td>
        <td>${t.sell_price ?? "—"}</td><td>${t.sell_quantity ?? "—"}</td>
      </tr>`).join("");
    block.innerHTML = `
      <h3 class="tx-date">${date}</h3>
      <table class="data-table">
        <thead><tr><th>代码</th><th>名称</th><th>买入价</th><th>买入量</th><th>卖出价</th><th>卖出量</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    wrap.appendChild(block);
  }
}

document.querySelectorAll(".range-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.days === "all" ? "all" : Number(btn.dataset.days);
    renderChart();
  });
});

loadAll();
