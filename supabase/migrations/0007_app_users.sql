-- 帳號系統：app_users + bcrypt RPC + members 綁定帳號
create extension if not exists pgcrypto;

create table app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index uq_app_users_username on app_users (lower(username));

alter table app_users enable row level security;
-- 不建立任何 policy：anon 無法直接讀寫，只能透過以下 security definer 函式

alter table members add column user_id uuid references app_users(id) on delete set null;
create index idx_members_user on members(user_id);

create or replace function register_user(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if length(trim(p_username)) < 2 then raise exception '帳號至少 2 個字'; end if;
  if length(p_password) < 6 then raise exception '密碼至少 6 碼'; end if;
  if exists (select 1 from app_users where lower(username) = lower(trim(p_username))) then
    raise exception '這個帳號已被使用';
  end if;
  insert into app_users (username, password_hash)
  values (trim(p_username), crypt(p_password, gen_salt('bf')))
  returning id into v_id;
  return json_build_object('id', v_id, 'username', trim(p_username));
end $$;

create or replace function login_user(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v app_users;
begin
  select * into v from app_users
  where lower(username) = lower(trim(p_username))
    and password_hash = crypt(p_password, password_hash);
  if v.id is null then raise exception '帳號或密碼錯誤'; end if;
  return json_build_object('id', v.id, 'username', v.username);
end $$;

grant execute on function register_user(text, text) to anon;
grant execute on function login_user(text, text) to anon;
