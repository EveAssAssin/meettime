-- 多目標里程碑
create table milestones (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  title text not null,
  target_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_milestones_meeting on milestones(meeting_id);

alter table milestones enable row level security;
create policy "anon all milestones" on milestones
  for all using (true) with check (true);

alter publication supabase_realtime add table milestones;

-- 既有 meeting 的 meet_at 轉為第一個里程碑
insert into milestones (meeting_id, title, target_at)
select id, '見面日', meet_at from meetings;
