# 基金净值管理系统

基金经理每日录入仓位与操作，自动计算单股净值；用户登录查看净值曲线与操作明细。
部署在 GitHub Pages + Supabase，零服务器、零本地依赖。

## 技术栈

- 前端：纯静态 HTML/JS（vanilla，无构建），Chart.js 画曲线图
- 后端：Supabase（Postgres 数据库 + Auth 登录鉴权 + RLS 行级权限）
- 托管：GitHub Pages

---

## 部署步骤（约 15 分钟）

### 第 1 步：创建 Supabase 项目

1. 访问 https://supabase.com 注册并新建项目，记下区域和密码。
2. 进入项目，打开 **SQL Editor** → New query。
3. 把本仓库 `sql/schema.sql` 的全部内容粘贴进去，点 **Run** 执行。
   执行后会创建 5 张表 + 自动建用户档案的触发器 + RLS 权限策略。

### 第 2 步：创建账号

1. 进入 **Authentication → Users → Add user**。
2. 填入经理邮箱、密码，勾选 **Auto Confirm User**，保存。
3. 创建普通用户账号，同样勾选 Auto Confirm。
4. 回到 **SQL Editor**，执行（把邮箱换成你的经理邮箱）：

   ```sql
   update public.profiles set role = 'manager'
   where id = (select id from auth.users where email = '你的经理邮箱');
   ```

   这一步把该账号的角色改为基金经理。其他账号默认是 `user`。

### 第 3 步：填入前端配置

1. 进入 **Project Settings → API**，复制：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public key**
2. 打开本仓库 `js/config.js`，把两个占位符替换成上面的值。

   > anon key 是公开密钥，放前端是安全的。写操作由数据库的 RLS 策略保护——只有 manager 角色能写。

### 第 4 步：推到 GitHub 并开启 Pages

1. 在 GitHub 新建仓库（如 `fund-nav-app`），把本目录所有文件推上去：

   ```bash
   git init
   git add .
   git commit -m "feat: init fund nav app"
   git branch -M main
   git remote add origin https://github.com/你的用户名/fund-nav-app.git
   git push -u origin main
   ```

2. 进入仓库 **Settings → Pages**。
3. **Source** 选 `Deploy from a branch`，Branch 选 `main` / `(root)`，保存。
4. 等约 1 分钟，访问 `https://你的用户名.github.io/fund-nav-app/` 即可。

---

## 使用流程

### 基金经理

1. 用经理账号登录 → 自动进入经理后台。
2. 首次进入会弹窗，填入**初始仓位**（如 1,000,000）。
3. 每日：选日期 → 填**当日仓位价值** → 保存。单股净值自动算出（= 当日仓位 / 初始仓位）。
4. 若当日有交易：在"当日操作记录"区填股票代码（自动带名称）、买/卖价量，点添加。
5. 当日无操作就留空，不影响净值。

### 普通用户

- 用用户账号登录 → 看到最新净值、涨跌幅、曲线图、历史明细、每日操作（全部只读）。

---

## 目录结构

```
fund-nav-app/
├── index.html          # 登录页
├── manager.html        # 经理后台
├── user.html           # 用户查看页
├── css/style.css       # 样式
├── js/
│   ├── config.js       # Supabase 配置（部署前填写）
│   ├── supabase.js     # 客户端
│   ├── auth.js         # 登录守卫
│   ├── common.js       # 曲线图 + 格式化工具
│   ├── stocks.js       # 股票名称查询
│   ├── login.js        # 登录逻辑
│   ├── manager.js      # 经理后台逻辑
│   └── user.js         # 用户页逻辑
└── sql/schema.sql      # 数据库 schema（在 Supabase 执行）
```

---

## 常见问题

**Q：股票代码带不出名称？**
A：东方财富 API 偶发不稳定，可直接手填名称。带出后会缓存到 `stock_cache` 表，下次秒查。

**Q：如何新增/删除用户？**
A：在 Supabase → Authentication → Users 管理。新用户注册后默认是 `user` 角色。要升级为经理，按第 2 步的 SQL 改 role。

**Q：忘了密码？**
A：在 Supabase → Users 里点用户旁边的重置密码，或用 Dashboard 发重置邮件。

**Q：想修改初始仓位？**
A：直接在 Supabase → Table Editor → `fund_config` 改。注意这会让历史净值的含义变化（净值是相对初始仓位的比例）。

**Q：Supabase 免费额度够吗？**
A：免费版含 500MB 数据库、50000 月活用户、2GB 流量，对个人基金展示足够。
