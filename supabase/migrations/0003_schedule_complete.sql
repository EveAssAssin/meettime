-- 行程完成打勾
alter table schedules add column completed_at timestamptz;
