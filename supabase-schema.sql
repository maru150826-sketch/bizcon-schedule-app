-- SAMPO QUEST fixed-team scheduler schema
-- 既存プロジェクトに対しても再実行しやすいようにしています。
-- groups に app_key を追加し、URLやグループコードなしで固定チームを読み込めるようにします。

create extension if not exists "pgcrypto";

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  app_key text,
  name text not null,
  description text,
  purpose text,
  admin_name text,
  created_at timestamp with time zone default now()
);

alter table public.groups add column if not exists app_key text;
create unique index if not exists groups_app_key_unique on public.groups(app_key) where app_key is not null;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  name text not null,
  role_memo text,
  created_at timestamp with time zone default now(),
  unique(group_id, name)
);

create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  task_title text,
  location text,
  memo text,
  is_confirmed boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  time_slot_id uuid references public.time_slots(id) on delete cascade,
  status text not null check (status in ('available', 'maybe', 'unavailable')),
  comment text,
  updated_at timestamp with time zone default now(),
  unique(member_id, time_slot_id)
);

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  time_slot_id uuid references public.time_slots(id) on delete cascade,
  todo text,
  decisions text,
  homework text,
  memo text,
  updated_at timestamp with time zone default now(),
  unique(time_slot_id)
);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.time_slots enable row level security;
alter table public.responses enable row level security;
alter table public.meeting_notes enable row level security;

-- 既存ポリシーがある場合は削除

drop policy if exists "Allow anon select groups" on public.groups;
drop policy if exists "Allow anon insert groups" on public.groups;
drop policy if exists "Allow anon update groups" on public.groups;

drop policy if exists "Allow anon select members" on public.members;
drop policy if exists "Allow anon insert members" on public.members;
drop policy if exists "Allow anon update members" on public.members;

drop policy if exists "Allow anon select time_slots" on public.time_slots;
drop policy if exists "Allow anon insert time_slots" on public.time_slots;
drop policy if exists "Allow anon update time_slots" on public.time_slots;

drop policy if exists "Allow anon select responses" on public.responses;
drop policy if exists "Allow anon insert responses" on public.responses;
drop policy if exists "Allow anon update responses" on public.responses;

drop policy if exists "Allow anon select meeting_notes" on public.meeting_notes;
drop policy if exists "Allow anon insert meeting_notes" on public.meeting_notes;
drop policy if exists "Allow anon update meeting_notes" on public.meeting_notes;

-- 最初は、同じURLを知っているメンバー全員が読み書きできる設計です。
-- 管理者認証は後から追加できます。

create policy "Allow anon select groups" on public.groups for select to anon using (true);
create policy "Allow anon insert groups" on public.groups for insert to anon with check (true);
create policy "Allow anon update groups" on public.groups for update to anon using (true) with check (true);

create policy "Allow anon select members" on public.members for select to anon using (true);
create policy "Allow anon insert members" on public.members for insert to anon with check (true);
create policy "Allow anon update members" on public.members for update to anon using (true) with check (true);

create policy "Allow anon select time_slots" on public.time_slots for select to anon using (true);
create policy "Allow anon insert time_slots" on public.time_slots for insert to anon with check (true);
create policy "Allow anon update time_slots" on public.time_slots for update to anon using (true) with check (true);

create policy "Allow anon select responses" on public.responses for select to anon using (true);
create policy "Allow anon insert responses" on public.responses for insert to anon with check (true);
create policy "Allow anon update responses" on public.responses for update to anon using (true) with check (true);

create policy "Allow anon select meeting_notes" on public.meeting_notes for select to anon using (true);
create policy "Allow anon insert meeting_notes" on public.meeting_notes for insert to anon with check (true);
create policy "Allow anon update meeting_notes" on public.meeting_notes for update to anon using (true) with check (true);
