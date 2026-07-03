import { supabase } from "./supabase.js";

// 股票代码 → 名称查询
// 优先级：本地缓存表 → 东方财富搜索 API → 返回 null（由前端兜底手填）
export async function lookupStockName(code) {
  if (!code) return null;
  code = code.trim();

  // 1) 本地缓存
  const { data: cached } = await supabase
    .from("stock_cache")
    .select("name")
    .eq("code", code)
    .maybeSingle();
  if (cached?.name) return cached.name;

  // 2) 东方财富搜索 API（CORS 友好）
  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(code)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const list = json?.QuotationCodeTable?.Data || [];
      // 匹配完全相等的代码
      const hit = list.find((d) => d.Code === code) || list[0];
      if (hit?.Name) {
        // 写入缓存（经理才有写权限，失败静默忽略）
        supabase.from("stock_cache").upsert({ code, name: hit.Name }).then(() => {});
        return hit.Name;
      }
    }
  } catch (e) {
    // 网络或 CORS 异常，降级手填
  }
  return null;
}
