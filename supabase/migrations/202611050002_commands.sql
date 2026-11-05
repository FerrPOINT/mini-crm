begin;

-- Same boundary whitespace as JavaScript String.trim(), including U+FEFF.
create function private.trim_text(value text) returns text
language sql immutable strict set search_path = '' as $$
  select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.trim_text(text) from public, anon, authenticated;

create function public.create_site(p_id uuid, p_name text, p_address text)
returns public.sites language plpgsql security definer set search_path = '' as $$
declare
  saved public.sites;
  clean_name text := private.trim_text(p_name);
  clean_address text := private.trim_text(p_address);
begin
  if not private.is_manager() then
    raise exception 'Создание доступно только постановщику' using errcode = '42501';
  end if;
  insert into public.sites (id, name, address) values (p_id, clean_name, clean_address)
  on conflict (id) do nothing returning * into saved;
  if not found then
    select * into saved from public.sites where id = p_id;
    if saved.deleted_at is not null or saved.name is distinct from clean_name
       or saved.address is distinct from clean_address then
      raise exception 'Объект уже создан с другими данными. Обновите список' using errcode = 'PT409';
    end if;
  end if;
  return saved;
end;
$$;

create function public.create_task(
  p_id uuid, p_title text, p_description text, p_site_id uuid, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  saved public.tasks;
  clean_title text := private.trim_text(p_title);
  clean_description text := private.trim_text(p_description);
begin
  if not private.is_manager() then
    raise exception 'Создание доступно только постановщику' using errcode = '42501';
  end if;
  -- Parent before child: delete_site uses the same lock order.
  perform 1 from public.sites where id = p_site_id and deleted_at is null for share;
  if not found then
    raise exception 'Объект не найден или удалён' using errcode = '23514';
  end if;
  insert into public.tasks (id, title, description, site_id, assignee_id)
  values (p_id, clean_title, clean_description, p_site_id, p_assignee_id)
  on conflict (id) do nothing returning * into saved;
  if not found then
    select * into saved from public.tasks where id = p_id;
    if saved.deleted_at is not null or saved.author_id is distinct from auth.uid()
       or saved.title is distinct from clean_title or saved.description is distinct from clean_description
       or saved.site_id is distinct from p_site_id or saved.assignee_id is distinct from p_assignee_id then
      raise exception 'Задача уже создана с другими данными. Обновите список' using errcode = 'PT409';
    end if;
  end if;
  return saved;
end;
$$;

create function public.update_task(
  p_task_id uuid, p_expected_site_id uuid, p_site_id uuid,
  p_title text, p_description text, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  saved public.tasks;
begin
  if not private.is_manager() then
    raise exception 'Редактирование доступно только постановщику' using errcode = '42501';
  end if;
  -- Sorted parents before the task, including a move between two sites.
  perform 1 from public.sites where id in (p_expected_site_id, p_site_id)
    and deleted_at is null order by id for share;
  select * into saved from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    raise exception 'Задача недоступна' using errcode = '42501';
  end if;
  if saved.site_id is distinct from p_expected_site_id then
    raise exception 'Объект задачи изменился. Обновите карточку' using errcode = 'PT409';
  end if;
  update public.tasks set title = private.trim_text(p_title), description = private.trim_text(p_description),
    site_id = p_site_id, assignee_id = p_assignee_id where id = p_task_id returning * into saved;
  return saved;
end;
$$;

-- Public writes must use commands so retries and parent/child locking have one owner.
revoke insert (name, address) on public.sites from authenticated;
revoke insert (title, description, site_id, assignee_id),
  update (title, description, site_id, assignee_id) on public.tasks from authenticated;
drop policy sites_create on public.sites;
drop policy tasks_create on public.tasks;
drop policy tasks_edit on public.tasks;

revoke all on function public.create_site(uuid, text, text),
  public.create_task(uuid, text, text, uuid, uuid),
  public.update_task(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_site(uuid, text, text),
  public.create_task(uuid, text, text, uuid, uuid),
  public.update_task(uuid, uuid, uuid, text, text, uuid) to authenticated;

create or replace function public.transition_task(
  p_task_id uuid,
  p_expected_status public.task_status,
  p_next_status public.task_status,
  p_comment text default null
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  current_task public.tasks;
  actor_role public.app_role;
  clean_comment text := nullif(private.trim_text(p_comment), '');
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
    -- A stale form is a business conflict, not a retryable serialization failure.
    raise exception 'Статус задачи изменился. Обновите карточку' using errcode = 'PT409';
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

notify pgrst, 'reload schema';
commit;
