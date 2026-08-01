-- 全員可打勾（記錄達成者）+ Web Push 訂閱
alter table schedules add column completed_by uuid references members(id) on delete set null;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_push_room on push_subscriptions(room_id);

alter table push_subscriptions enable row level security;
create policy "anon all push_subscriptions" on push_subscriptions
  for all using (true) with check (true);
