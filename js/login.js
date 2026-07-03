import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";

const tabs = document.querySelectorAll(".role-tab");
let selectedRole = "user";

// 切换标签（仅 UI 提示，实际跳转由后端 role 决定）
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    selectedRole = tab.dataset.role;
  });
});

const form = document.getElementById("loginForm");
const errorEl = document.getElementById("loginError");
const btn = document.getElementById("loginBtn");

// 已登录则直接跳转
getCurrentUser().then((cur) => {
  if (cur?.profile) {
    window.location.href = cur.profile.role === "manager" ? "manager.html" : "user.html";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = "登录中...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = "账号或密码错误";
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "登 录";
    return;
  }

  // 按 role 跳转
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role || "user";
  // 若选了经理但实际是用户，给出提示
  if (selectedRole === "manager" && role !== "manager") {
    errorEl.textContent = "该账号不是基金经理";
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "登 录";
    await supabase.auth.signOut();
    return;
  }
  window.location.href = role === "manager" ? "manager.html" : "user.html";
});
