-- ============================================================
-- Bizcon Group Scheduler - Supabase Schema
-- Supabase SQL Editorでこのファイル全体を実行してください。
-- RLSは有効化し、招待URLを知っているanonユーザーが最小限の操作をできる設定です。
-- service_role keyはフロントエンドに絶対に入れないでください。
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  purpose text,
  admin_name text,
  created_at timestamp with time zone default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  name text not null,
  role_memo text,
  created_at timestamp with time zone default now(),
  constraint members_group_name_unique unique (group_id, name)
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
  constraint responses_member_slot_unique unique (member_id, time_slot_id)
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
  constraint meeting_notes_slot_unique unique (time_slot_id)
);

create index if not exists members_group_id_idx on public.members(group_id);
create index if not exists time_slots_group_id_idx on public.time_slots(group_id);
create index if not exists responses_group_id_idx on public.responses(group_id);
create index if not exists responses_member_slot_idx on public.responses(member_id, time_slot_id);
create index if not exists meeting_notes_group_id_idx on public.meeting_notes(group_id);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.time_slots enable row level security;
alter table public.responses enable row level security;
alter table public.meeting_notes enable row level security;

-- 既存ポリシーを作り直しやすくするためのdrop
-- Supabase SQL Editorで再実行してもエラーになりにくいようにしています。
drop policy if exists "anon can select groups" on public.groups;
drop policy if exists "anon can insert groups" on public.groups;
drop policy if exists "anon can select members" on public.members;
drop policy if exists "anon can insert members" on public.members;
drop policy if exists "anon can update members" on public.members;
drop policy if exists "anon can select time_slots" on public.time_slots;
drop policy if exists "anon can insert time_slots" on public.time_slots;
drop policy if exists "anon can update time_slots" on public.time_slots;
drop policy if exists "anon can select responses" on public.responses;
drop policy if exists "anon can insert responses" on public.responses;
drop policy if exists "anon can update responses" on public.responses;
drop policy if exists "anon can select meeting_notes" on public.meeting_notes;
drop policy if exists "anon can insert meeting_notes" on public.meeting_notes;
drop policy if exists "anon can update meeting_notes" on public.meeting_notes;

-- groups: 共有URL作成と閲覧
create policy "anon can select groups"
on public.groups for select
to anon
using (true);

create policy "anon can insert groups"
on public.groups for insert
to anon
with check (true);

-- members: 共有URL参加者の閲覧・登録・メモ更新
create policy "anon can select members"
on public.members for select
to anon
using (true);

create policy "anon can insert members"
on public.members for insert
to anon
with check (
  exists (
    select 1 from public.groups g
    where g.id = members.group_id
  )
);

create policy "anon can update members"
on public.members for update
to anon
using (true)
with check (true);

-- time_slots: 候補日時の閲覧・追加・確定状態更新
create policy "anon can select time_slots"
on public.time_slots for select
to anon
using (true);

create policy "anon can insert time_slots"
on public.time_slots for insert
to anon
with check (
  exists (
    select 1 from public.groups g
    where g.id = time_slots.group_id
  )
);

create policy "anon can update time_slots"
on public.time_slots for update
to anon
using (true)
with check (true);

-- responses: 回答の閲覧・登録・更新
create policy "anon can select responses"
on public.responses for select
to anon
using (true);

create policy "anon can insert responses"
on public.responses for insert
to anon
with check (
  exists (
    select 1 from public.groups g
    where g.id = responses.group_id
  )
  and exists (
    select 1 from public.members m
    where m.id = responses.member_id
    and m.group_id = responses.group_id
  )
  and exists (
    select 1 from public.time_slots ts
    where ts.id = responses.time_slot_id
    and ts.group_id = responses.group_id
  )
);

create policy "anon can update responses"
on public.responses for update
to anon
using (true)
with check (true);

-- meeting_notes: 確定作業日の進行管理メモ
create policy "anon can select meeting_notes"
on public.meeting_notes for select
to anon
using (true);

create policy "anon can insert meeting_notes"
on public.meeting_notes for insert
to anon
with check (
  exists (
    select 1 from public.groups g
    where g.id = meeting_notes.group_id
  )
  and exists (
    select 1 from public.time_slots ts
    where ts.id = meeting_notes.time_slot_id
    and ts.group_id = meeting_notes.group_id
  )
);

create policy "anon can update meeting_notes"
on public.meeting_notes for update
to anon
using (true)
with check (true);
