-- SAMPO QUEST fixed-team scheduler schema v8
-- 回答者選択式・スマホ/PC共通操作・削除対応・確定解除対応版。
-- 既存プロジェクトに対しても再実行しやすいようにしています。

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
  owner_token text,
  created_at timestamp with time zone default now(),
  unique(group_id, name)
);

alter table public.members add column if not exists owner_token text;

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
  created_by_member_id uuid,
  created_by_token text,
  created_at timestamp with time zone default now()
);

alter table public.time_slots add column if not exists created_by_member_id uuid;
alter table public.time_slots add column if not exists created_by_token text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_slots_created_by_member_id_fkey'
  ) then
    alter table public.time_slots
      add constraint time_slots_created_by_member_id_fkey
      foreign key (created_by_member_id)
      references public.members(id)
      on delete set null;
  end if;
end $$;

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
-- 削除は通常のDELETEポリシーではなく、下のRPC関数で「この端末で作ったデータか」を確認して実行します。

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

-- 自分の回答者データ削除用RPC
-- member削除時、responsesは外部キー on delete cascade により自動で削除されます。

create or replace function public.delete_member_if_owner(
  p_member_id uuid,
  p_owner_token text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.members
  where id = p_member_id
    and (
      owner_token = p_owner_token
      or owner_token is null
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 自分が追加した候補日削除用RPC
-- time_slot削除時、responsesとmeeting_notesは外部キー on delete cascade により自動で削除されます。
-- 旧版で作られた候補日は作成者情報がないため、チーム内で削除可能にしています。

create or replace function public.delete_time_slot_if_owner(
  p_time_slot_id uuid,
  p_member_id uuid,
  p_owner_token text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.time_slots
  where id = p_time_slot_id
    and (
      created_by_token = p_owner_token
      or created_by_member_id = p_member_id
      or (created_by_token is null and created_by_member_id is null)
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_member_if_owner(uuid, text) to anon;
grant execute on function public.delete_time_slot_if_owner(uuid, uuid, text) to anon;


-- v7: ログインなしで「選択中の回答者」として削除できる簡易RPC
-- 4人程度のチーム内利用を想定。厳密な本人確認はしません。

create or replace function public.delete_member_by_selection(
  p_member_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.members
  where id = p_member_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.delete_time_slot_by_selection(
  p_time_slot_id uuid,
  p_member_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.time_slots
  where id = p_time_slot_id
    and (
      created_by_member_id = p_member_id
      or created_by_member_id is null
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_member_by_selection(uuid) to anon;
grant execute on function public.delete_time_slot_by_selection(uuid, uuid) to anon;
