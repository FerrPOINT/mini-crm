begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.app_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'rework');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  role public.app_role not null
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  address text not null check (length(btrim(address)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  site_id uuid not null references public.sites(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create index tasks_assignee_active_idx on public.tasks (assignee_id, created_at desc, id) where deleted_at is null;
create index tasks_site_active_idx on public.tasks (site_id, created_at desc, id) where deleted_at is null;
create index tasks_author_idx on public.tasks (author_id);
create index task_history_task_idx on public.task_history (task_id, created_at, id);
create index task_history_actor_idx on public.task_history (actor_id);

create function private.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager'); $$;

revoke all on function private.is_manager() from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

revoke all on public.profiles, public.sites, public.tasks, public.task_history from public, anon, authenticated;
grant select on public.profiles, public.sites, public.tasks, public.task_history to authenticated;
grant insert (name, address), update (name, address) on public.sites to authenticated;
grant insert (title, description, site_id, assignee_id), update (title, description, site_id, assignee_id) on public.tasks to authenticated;
grant all on public.profiles, public.sites, public.tasks, public.task_history to service_role;
grant usage, select on sequence public.task_history_id_seq to service_role;

create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select private.is_manager()) or exists (
    select 1 from public.tasks t where t.author_id = profiles.id and t.assignee_id = (select auth.uid()) and t.deleted_at is null
  ) or exists (select 1 from public.task_history h where h.actor_id = profiles.id)
);

create policy tasks_read on public.tasks for select to authenticated using (
  deleted_at is null and ((select private.is_manager()) or assignee_id = (select auth.uid()))
);
create policy tasks_create on public.tasks for insert to authenticated with check (
  (select private.is_manager()) and author_id = (select auth.uid()) and status = 'new' and deleted_at is null
);
create policy tasks_edit on public.tasks for update to authenticated
using (deleted_at is null and (select private.is_manager()))
with check (deleted_at is null and (select private.is_manager()));

create policy sites_read on public.sites for select to authenticated using (
  deleted_at is null and ((select private.is_manager()) or exists (
    select 1 from public.tasks t where t.site_id = sites.id and t.assignee_id = (select auth.uid()) and t.deleted_at is null
  ))
);
create policy sites_create on public.sites for insert to authenticated with check ((select private.is_manager()) and deleted_at is null);
create policy sites_edit on public.sites for update to authenticated using (deleted_at is null and (select private.is_manager()))
with check (deleted_at is null and (select private.is_manager()));

create policy history_read on public.task_history for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_history.task_id)
);

create function private.validate_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Исполнителем может быть только пользователь с ролью исполнителя' using errcode = '23514';
  end if;
  perform 1 from public.sites where id = new.site_id and deleted_at is null for share;
  if not found then
    raise exception 'Объект не найден или удалён' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_task before insert or update of site_id, assignee_id on public.tasks
for each row execute function private.validate_task();

create function private.record_task_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_history (task_id, actor_id, from_status, to_status)
  values (new.id, new.author_id, null, new.status);
  return new;
end;
$$;

create trigger record_task_creation after insert on public.tasks
for each row execute function private.record_task_creation();

create function public.transition_task(
  p_task_id uuid,
  p_expected_status public.task_status,
  p_next_status public.task_status,
  p_comment text default null
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  current_task public.tasks;
  actor_role public.app_role;
  clean_comment text := nullif(btrim(p_comment), '');
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;
  select * into current_task from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found or (actor_role <> 'manager' and current_task.assignee_id <> auth.uid()) then
    raise exception 'Задача недоступна' using errcode = '42501';
  end if;
  if p_expected_status is null or current_task.status <> p_expected_status then
    raise exception 'Статус задачи изменился. Обновите карточку' using errcode = '40001';
  end if;
  if p_next_status is null or not (
    (actor_role = 'executor' and current_task.assignee_id = auth.uid() and (
      (current_task.status in ('new', 'rework') and p_next_status = 'in_progress') or
      (current_task.status = 'in_progress' and p_next_status = 'in_review')
    )) or
    (actor_role = 'manager' and current_task.status = 'in_review' and p_next_status in ('accepted', 'rework'))
  ) then
    raise exception 'Этот переход статуса запрещён' using errcode = '23514';
  end if;
  if p_next_status = 'rework' and clean_comment is null then
    raise exception 'Для возврата на доработку нужен комментарий' using errcode = '23514';
  end if;
  if length(clean_comment) > 2000 then
    raise exception 'Комментарий не должен превышать 2000 символов' using errcode = '23514';
  end if;
  update public.tasks set status = p_next_status where id = current_task.id returning * into current_task;
  insert into public.task_history (task_id, actor_id, from_status, to_status, comment)
  values (current_task.id, auth.uid(), p_expected_status, p_next_status, clean_comment);
  return current_task;
end;
$$;

create function public.delete_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'Удаление доступно только постановщику' using errcode = '42501';
  end if;
  update public.tasks set deleted_at = now() where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Задача не найдена' using errcode = 'P0002'; end if;
end;
$$;

create function public.delete_site(p_site_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'Удаление доступно только постановщику' using errcode = '42501';
  end if;
  perform 1 from public.sites where id = p_site_id and deleted_at is null for update;
  if not found then raise exception 'Объект не найден' using errcode = 'P0002'; end if;
  update public.tasks set deleted_at = now() where site_id = p_site_id and deleted_at is null;
  update public.sites set deleted_at = now() where id = p_site_id;
end;
$$;

revoke all on function private.validate_task(), private.record_task_creation() from public, anon, authenticated;
revoke all on function public.transition_task(uuid, public.task_status, public.task_status, text), public.delete_task(uuid), public.delete_site(uuid) from public, anon, authenticated;
grant execute on function public.transition_task(uuid, public.task_status, public.task_status, text), public.delete_task(uuid), public.delete_site(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
