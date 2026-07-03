import { supabase } from "./supabase.js";

// 获取当前登录用户 + profile（含 role）
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", session.user.id)
    .single();
  if (error) return { session, profile: null };
  return { session, profile };
}

// 页面权限守卫：未登录跳登录页；角色不符跳对应页
export async function requireAuth(allowedRole = null) {
  const current = await getCurrentUser();
  if (!current || !current.profile) {
    window.location.href = "index.html";
    return null;
  }
  const role = current.profile.role;
  if (allowedRole && role !== allowedRole) {
    window.location.href = role === "manager" ? "manager.html" : "user.html";
    return null;
  }
  return current;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}
