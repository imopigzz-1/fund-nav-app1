-- ============================================================
-- 基金净值管理系统 - 数据库 Schema + RLS
-- 在 Supabase Dashboard → SQL Editor 中执行本文件
-- ============================================================

-- ---------- 1. profiles：扩展 auth.users，增加 role ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null check (role in ('manager','user')) default 'user',
  created_at timestamptz not null default now()
);

-- 注册时自动创建 profile（默认 role=user）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. fund_config：单行（id=1）存初始仓位 ----------
create table if not exists public.fund_config (
  id int primary key check (id = 1),
  initial_position numeric(18,2) not null check (initial_position > 0),
  initial_position_date date not null default current_date,
  updated_at timestamptz not null default now()
);

-- ---------- 3. daily_nav：每日仓位价值，nav 由应用层计算 ----------
create table if not exists public.daily_nav (
  date date primary key,
  position_value numeric(18,2) not null check (position_value >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 4. transactions：每日操作记录 ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  stock_code text not null,
  stock_name text not null,
  buy_price numeric(12,4),
  buy_quantity int check (buy_quantity is null or buy_quantity > 0),
  sell_price numeric(12,4),
  sell_quantity int check (sell_quantity is null or sell_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions(date);

-- ---------- 5. stock_cache：股票代码-名称缓存 ----------
create table if not exists public.stock_cache (
  code text primary key,
  name text not null,
  updated_at timestamptz not null default now()
);

-- ---------- 6. 通用 updated_at 触发器 ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['fund_config','daily_nav','transactions','stock_cache'] loop
    execute format('drop trigger if exists set_updated_at_%s on public.%s;', t, t);
    execute format('create trigger set_updated_at_%s before update on public.%s for each row execute function public.set_updated_at();', t, t);
  end loop;
end$$;

-- ---------- 7. RLS ----------
alter table public.profiles      enable row level security;
alter table public.fund_config   enable row level security;
alter table public.daily_nav     enable row level security;
alter table public.transactions  enable row level security;
alter table public.stock_cache   enable row level security;

-- 判断当前用户是否为基金经理
create or replace function public.is_manager()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$ language sql security definer stable;

-- profiles：本人可读自己，经理可读全部
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_manager());

-- fund_config：登录可读，仅经理可写
drop policy if exists "config read" on public.fund_config;
drop policy if exists "config write" on public.fund_config;
create policy "config read" on public.fund_config
  for select to authenticated using (true);
create policy "config write" on public.fund_config
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- daily_nav：登录可读，仅经理可写
drop policy if exists "nav read" on public.daily_nav;
drop policy if exists "nav write" on public.daily_nav;
create policy "nav read" on public.daily_nav
  for select to authenticated using (true);
create policy "nav write" on public.daily_nav
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- transactions：登录可读，仅经理可写
drop policy if exists "tx read" on public.transactions;
drop policy if exists "tx write" on public.transactions;
create policy "tx read" on public.transactions
  for select to authenticated using (true);
create policy "tx write" on public.transactions
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- stock_cache：登录可读，仅经理可写
drop policy if exists "stock read" on public.stock_cache;
drop policy if exists "stock write" on public.stock_cache;
create policy "stock read" on public.stock_cache
  for select to authenticated using (true);
create policy "stock write" on public.stock_cache
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ============================================================
-- 执行完毕。下一步：在 Auth → Users 中创建经理账号，
-- 然后在 SQL Editor 中将其 role 改为 manager（见 README）
-- ============================================================
