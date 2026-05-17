create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  plan_code text not null default 'free' check (plan_code in ('free', 'pro', 'plus', 'ultra')),
  wallet_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  plan_code text not null default 'free' check (plan_code in ('free', 'pro', 'plus', 'ultra')),
  interval text not null default 'monthly' check (interval in ('monthly', 'yearly')),
  status text not null default 'inactive',
  razorpay_customer_id text,
  razorpay_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'razorpay',
  status text not null default 'created',
  amount integer not null default 0,
  currency text not null default 'INR',
  razorpay_payment_id text unique,
  razorpay_order_id text,
  razorpay_subscription_id text,
  invoice_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'New chat',
  folder text,
  shared_slug text unique,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat_history(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  chat_id uuid references public.chat_history(id) on delete set null,
  model text not null,
  tokens integer not null default 0,
  cost_cents integer not null default 0,
  feature text not null default 'chat',
  status text not null default 'success',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme text not null default 'dark',
  notifications_enabled boolean not null default true,
  preferred_model text not null default 'gpt-4.1-mini',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  rate_limit_per_minute integer not null default 60,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists users_plan_code_idx on public.users(plan_code);
create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists chat_history_user_id_updated_at_idx on public.chat_history(user_id, updated_at desc);
create index if not exists messages_chat_id_created_at_idx on public.messages(chat_id, created_at);
create index if not exists ai_usage_user_id_created_at_idx on public.ai_usage(user_id, created_at desc);
create index if not exists api_keys_user_id_idx on public.api_keys(user_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_chat_history_updated_at on public.chat_history;
create trigger set_chat_history_updated_at before update on public.chat_history
for each row execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.users.full_name, excluded.full_name),
      avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url);

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, plan_code, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.chat_history enable row level security;
alter table public.messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.settings enable row level security;
alter table public.api_keys enable row level security;
alter table public.admin_logs enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile" on public.users for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions" on public.subscriptions for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can manage own subscriptions" on public.subscriptions;
create policy "Users can manage own subscriptions" on public.subscriptions for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments" on public.payments for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can create own payments" on public.payments;
create policy "Users can create own payments" on public.payments for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can manage own chats" on public.chat_history;
create policy "Users can manage own chats" on public.chat_history for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can manage own messages" on public.messages;
create policy "Users can manage own messages" on public.messages for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can read own usage" on public.ai_usage;
create policy "Users can read own usage" on public.ai_usage for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own usage" on public.ai_usage;
create policy "Users can insert own usage" on public.ai_usage for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can manage own settings" on public.settings;
create policy "Users can manage own settings" on public.settings for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can manage own api keys" on public.api_keys;
create policy "Users can manage own api keys" on public.api_keys for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admins can read logs" on public.admin_logs;
create policy "Admins can read logs" on public.admin_logs for select
using (public.is_admin());

drop policy if exists "Admins can insert logs" on public.admin_logs;
create policy "Admins can insert logs" on public.admin_logs for insert
with check (public.is_admin() or auth.uid() = user_id);
