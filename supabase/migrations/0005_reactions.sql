-- 行程表情回應
create table schedule_reactions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, member_id, emoji)
);

create index idx_reactions_schedule on schedule_reactions(schedule_id);

alter table schedule_reactions enable row level security;
create policy "anon all reactions" on schedule_reactions
  for all using (true) with check (true);

alter publication supabase_realtime add table schedule_reactions;
