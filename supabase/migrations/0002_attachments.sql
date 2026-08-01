-- 附件系統：行程附件 + 見面（主倒數）附件
create table attachments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  schedule_id uuid references schedules(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  file_url text not null,
  file_name text not null,
  file_type text,
  created_at timestamptz not null default now(),
  check (meeting_id is not null or schedule_id is not null)
);

create index idx_attachments_meeting on attachments(meeting_id);
create index idx_attachments_schedule on attachments(schedule_id);

alter table attachments enable row level security;
create policy "anon all attachments" on attachments for all using (true) with check (true);

alter publication supabase_realtime add table attachments;

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "anon upload att" on storage.objects
  for insert with check (bucket_id = 'attachments');
create policy "anon read att" on storage.objects
  for select using (bucket_id = 'attachments');
