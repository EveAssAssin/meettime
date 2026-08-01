-- MeetTime 初始 schema
create extension if not exists pgcrypto;

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  theme text not null default 'midnight',
  owner_member_id uuid,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  nickname text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  title text not null,
  meet_at timestamptz not null,
  note text,
  status text not null default 'active' check (status in ('active','done','archived')),
  photo_url text,
  show_photo boolean not null default true,
  created_at timestamptz not null default now()
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index idx_members_room on members(room_id);
create index idx_meetings_room on meetings(room_id);
create index idx_schedules_meeting on schedules(meeting_id);

-- RLS：房間碼即通行證（知道 code 才查得到 room，其餘表串 room 存取）
-- MVP 採 permissive 策略：anon 可讀寫，安全性依賴不可猜測的房間碼與 uuid。
alter table rooms enable row level security;
alter table members enable row level security;
alter table meetings enable row level security;
alter table schedules enable row level security;

create policy "anon all rooms" on rooms for all using (true) with check (true);
create policy "anon all members" on members for all using (true) with check (true);
create policy "anon all meetings" on meetings for all using (true) with check (true);
create policy "anon all schedules" on schedules for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table meetings, schedules, members, rooms;

-- 照片儲存 bucket（公開讀取）
insert into storage.buckets (id, name, public) values ('meeting-photos', 'meeting-photos', true)
on conflict (id) do nothing;

create policy "anon upload photos" on storage.objects
  for insert with check (bucket_id = 'meeting-photos');
create policy "anon read photos" on storage.objects
  for select using (bucket_id = 'meeting-photos');
