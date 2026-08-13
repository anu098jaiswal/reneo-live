-- ============================================================
-- Reneo Live — schema + RLS
-- Run this in the Supabase SQL editor (already applied manually
-- during development; kept here so the repo is reproducible).
-- ============================================================

-- ---------- TABLES ----------

create table profiles (
  id uuid references auth.users(id) primary key,
  name text not null,
  avatar text,
  role text not null check (role in ('seller','customer')),
  created_at timestamptz default now()
);

create table products (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) not null,
  name text not null,
  description text,
  price numeric not null,
  image_url text,
  stock int not null default 0,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table live_sessions (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references profiles(id) not null,
  product_id uuid references products(id) not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references live_sessions(id) not null,
  user_id uuid references profiles(id) not null,
  message text not null,
  created_at timestamptz default now()
);

create table cart_items (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references profiles(id) not null,
  product_id uuid references products(id) not null,
  quantity int not null default 1,
  created_at timestamptz default now()
);

-- ---------- ENABLE RLS ----------

alter table profiles enable row level security;
alter table products enable row level security;
alter table live_sessions enable row level security;
alter table chat_messages enable row level security;
alter table cart_items enable row level security;

-- ---------- POLICIES ----------

-- profiles
create policy "profiles_select_all"
on profiles for select
using ( true );

create policy "profiles_update_own"
on profiles for update
using ( auth.uid() = id );

create policy "profiles_insert_own"
on profiles for insert
with check ( auth.uid() = id );

-- products
create policy "products_select_all"
on products for select
using ( true );

create policy "products_insert_own"
on products for insert
with check ( auth.uid() = seller_id );

create policy "products_update_own"
on products for update
using ( auth.uid() = seller_id )
with check ( auth.uid() = seller_id );

create policy "products_delete_own"
on products for delete
using ( auth.uid() = seller_id );

-- live_sessions
create policy "live_sessions_select_all"
on live_sessions for select
using ( true );

create policy "live_sessions_insert_own"
on live_sessions for insert
with check ( auth.uid() = host_id );

create policy "live_sessions_update_own"
on live_sessions for update
using ( auth.uid() = host_id )
with check ( auth.uid() = host_id );

-- chat_messages
create policy "chat_messages_select_all"
on chat_messages for select
using ( true );

create policy "chat_messages_insert_own"
on chat_messages for insert
with check ( auth.uid() = user_id );

-- cart_items (private — only the owning customer can see/touch their cart)
create policy "cart_items_select_own"
on cart_items for select
using ( auth.uid() = customer_id );

create policy "cart_items_insert_own"
on cart_items for insert
with check ( auth.uid() = customer_id );

create policy "cart_items_update_own"
on cart_items for update
using ( auth.uid() = customer_id )
with check ( auth.uid() = customer_id );

create policy "cart_items_delete_own"
on cart_items for delete
using ( auth.uid() = customer_id );
