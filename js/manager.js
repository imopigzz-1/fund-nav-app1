import { supabase } from "./supabase.js";
import { requireAuth, signOut } from "./auth.js";
import { lookupStockName } from "./stocks.js";
import { renderNavChart, formatMoney, formatNav, todayStr } from "./common.js";

const user = await requireAuth("manager");
if (!user) throw new Error("unauthorized");

document.getElementById("managerName").textContent = `· ${user.profile.username || ""}`;
document.getElementById("logoutBtn").addEventListener("click", signOut);

let initialPosition = null;
let navChart = null;
let currentRange = 30;

// ---------- 初始仓位加载 ----------
async function loadConfig() {
  const { data } = await supabase.from("fund_config").select("*").eq("id", 1).maybeSingle();
  if (!data) {
    showSetupModal();
    return;
  }
  initialPosition = Number(data.initial_position);
  document.getElementById("initialPosition").textContent = formatMoney(initialPosition);
  document.getElementById("setupDate").value = todayStr();
  await refreshAll();
}

function showSetupModal() {
  document.getElementById("setupModal").hidden = false;
  document.getElementById("setupDate").value = todayStr();
}

document.getElementById("setupSaveBtn").addEventListener("click", async () => {
  const val = parseFloat(document.getElementById("setupInitial").value);
  const date = document.getElementById("setupDate").value;
  const err = document.getElementById("setupError");
  if (!(val > 0) || !date) {
    err.textContent = "请填写合法的初始仓位与日期";
    err.hidden = false;
    return;
  }
  const { error } = await supabase.from("fund_config").upsert({
    id: 1, initial_position: val, initial_position_date: date,
  });
  if (error) {
    err.textContent = "保存失败：" + error.message;
    err.hidden = false;
    return;
  }
  err.hidden = true;
  document.getElementById("setupModal").hidden = true;
  await loadConfig();
});

// ---------- 净值录入 ----------
const navDateEl = document.getElementById("navDate");
const positionValueEl = document.getElementById("positionValue");
const navValueEl = document.getElementById("navValue");
const txDateLabel = document.getElementById("txDateLabel");

navDateEl.value = todayStr();
txDateLabel.textContent = navDateEl.value;

navDateEl.addEventListener("change", async () => {
  txDateLabel.textContent = navDateEl.value;
  await loadDayData(navDateEl.value);
});

positionValueEl.addEventListener("input", updateNavPreview);

function updateNavPreview() {
  const v = parseFloat(positionValueEl.value);
  if (!(v >= 0) || !initialPosition) { navValueEl.textContent = "—"; return; }
  navValueEl.textContent = formatNav(v / initialPosition);
}

document.getElementById("saveNavBtn").addEventListener("click", async () => {
  const date = navDateEl.value;
  const v = parseFloat(positionValueEl.value);
  const msg = document.getElementById("navMsg");
  if (!date || !(v >= 0)) {
    msg.textContent = "请填写日期与仓位价值"; msg.style.color = "var(--danger)";
    return;
  }
  const { error } = await supabase.from("daily_nav").upsert({ date, position_value: v });
  if (error) {
    msg.textContent = "保存失败：" + error.message; msg.style.color = "var(--danger)";
    return;
  }
  msg.textContent = "已保存 ✓"; msg.style.color = "var(--success)";
  setTimeout(() => (msg.textContent = ""), 2000);
  await loadChart();
});

async function loadDayData(date) {
  // 当日仓位
  const { data: navRow } = await supabase
    .from("daily_nav").select("*").eq("date", date).maybeSingle();
  positionValueEl.value = navRow ? navRow.position_value : "";
  updateNavPreview();
  // 当日操作
  await loadTransactions(date);
}

// ---------- 当日操作 CRUD ----------
const txBody = document.getElementById("txTableBody");

async function loadTransactions(date) {
  const { data } = await supabase
    .from("transactions").select("*").eq("date", date).order("created_at");
  txBody.innerHTML = "";
  if (!data || data.length === 0) {
    txBody.innerHTML = `<tr><td colspan="7" class="empty-row">当日无操作记录</td></tr>`;
    return;
  }
  for (const t of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.stock_code}</td>
      <td>${t.stock_name}</td>
      <td>${t.buy_price ?? ""}</td>
      <td>${t.buy_quantity ?? ""}</td>
      <td>${t.sell_price ?? ""}</td>
      <td>${t.sell_quantity ?? ""}</td>
      <td><button class="btn btn-link danger" data-id="${t.id}">删除</button></td>`;
    txBody.appendChild(tr);
  }
  txBody.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("确认删除该条操作？")) return;
      await supabase.from("transactions").delete().eq("id", btn.dataset.id);
      await loadTransactions(navDateEl.value);
    });
  });
}

// 股票代码失焦自动带入名称
document.getElementById("txCode").addEventListener("blur", async (e) => {
  const code = e.target.value.trim();
  if (!code) return;
  const nameInput = document.getElementById("txName");
  if (nameInput.value.trim()) return;
  const name = await lookupStockName(code);
  if (name) nameInput.value = name;
});

document.getElementById("addTxBtn").addEventListener("click", async () => {
  const errEl = document.getElementById("txFormError");
  errEl.hidden = true;
  const date = navDateEl.value;
  const code = document.getElementById("txCode").value.trim();
  const name = document.getElementById("txName").value.trim();
  const buyPrice = document.getElementById("buyPrice").value;
  const buyQty = document.getElementById("buyQty").value;
  const sellPrice = document.getElementById("sellPrice").value;
  const sellQty = document.getElementById("sellQty").value;

  if (!date || !code || !name) {
    errEl.textContent = "请填写日期、股票代码与名称"; errEl.hidden = false; return;
  }
  const hasBuy = buyPrice || buyQty;
  const hasSell = sellPrice || sellQty;
  if (!hasBuy && !hasSell) {
    errEl.textContent = "至少填写一组买入或卖出信息"; errEl.hidden = false; return;
  }
  if (hasBuy && !(buyPrice && buyQty)) {
    errEl.textContent = "买入价与买入数量需同时填写"; errEl.hidden = false; return;
  }
  if (hasSell && !(sellPrice && sellQty)) {
    errEl.textContent = "卖出价与卖出数量需同时填写"; errEl.hidden = false; return;
  }

  const row = {
    date, stock_code: code, stock_name: name,
    buy_price: buyPrice || null, buy_quantity: buyQty || null,
    sell_price: sellPrice || null, sell_quantity: sellQty || null,
  };
  const { error } = await supabase.from("transactions").insert(row);
  if (error) {
    errEl.textContent = "添加失败：" + error.message; errEl.hidden = false; return;
  }
  ["txCode","txName","buyPrice","buyQty","sellPrice","sellQty"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  await loadTransactions(date);
});

// ---------- 曲线图 ----------
async function loadChart() {
  const { data } = await supabase.from("daily_nav").select("*").order("date");
  const config = await supabase.from("fund_config").select("initial_position").eq("id",1).maybeSingle();
  const init = config.data ? Number(config.data.initial_position) : initialPosition;
  navChart = renderNavChart("navChart", data || [], init, currentRange, navChart);
}

document.querySelectorAll(".range-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.days === "all" ? "all" : Number(btn.dataset.days);
    loadChart();
  });
});

async function refreshAll() {
  await loadDayData(navDateEl.value);
  await loadChart();
}

loadConfig();
