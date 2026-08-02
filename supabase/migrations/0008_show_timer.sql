-- 行程小倒數顯示開關（小組件用，預設關閉）
alter table schedules add column show_timer boolean not null default false;
