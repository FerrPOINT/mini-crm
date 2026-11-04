begin;

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
  clean_comment text := nullif(regexp_replace(p_comment, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
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
