import { db } from './supabase';
import type { HistoryEntry, Profile, Site, Status, Task } from './domain';

function result<T>({
  data,
  error,
  status,
}: {
  data: T;
  error: { message: string } | null;
  status?: number;
}): T {
  if (error)
    throw new Error(
      status === 0
        ? 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.'
        : error.message,
    );
  return data;
}
function row<T>(response: {
  data: T | null;
  error: { message: string } | null;
  status?: number;
}): T {
  const data = result(response);
  if (data === null) throw new Error('Запись не найдена или недоступна');
  return data;
}

const taskFields =
  'id,title,description,site_id,assignee_id,status,author_id,created_at,assignee:profiles!tasks_assignee_id_fkey(full_name),author:profiles!tasks_author_id_fkey(full_name),site:sites!tasks_site_id_fkey(name)';
const siteFields = 'id,name,address,created_at';
export const api = {
  async profile(id: string, signal?: AbortSignal): Promise<Profile> {
    return row(
      await db()
        .from('profiles')
        .select('id,full_name,role')
        .eq('id', id)
        .abortSignal(signal!)
        .single(),
    );
  },
  async executors(
    page: number,
    search: string,
    signal?: AbortSignal,
  ): Promise<{ rows: Profile[]; count: number }> {
    const response = await db()
      .from('profiles')
      .select('id,full_name,role', { count: 'exact' })
      .eq('role', 'executor')
      .ilike('full_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
      .order('full_name')
      .order('id')
      .range(page * 20, page * 20 + 19)
      .abortSignal(signal!);
    return { rows: result(response) ?? [], count: response.count ?? 0 };
  },
  async sites(
    page: number,
    signal?: AbortSignal,
    search = '',
  ): Promise<{ rows: Site[]; count: number }> {
    const response = await db()
      .from('sites')
      .select(siteFields, { count: 'exact' })
      .ilike('name', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
      .order('created_at', { ascending: false })
      .order('id')
      .range(page * 20, page * 20 + 19)
      .abortSignal(signal!);
    return { rows: result(response) ?? [], count: response.count ?? 0 };
  },
  async site(id: string, signal?: AbortSignal): Promise<Site> {
    return row(
      await db().from('sites').select(siteFields).eq('id', id).abortSignal(signal!).single(),
    );
  },
  async tasks(
    page: number,
    siteId?: string,
    signal?: AbortSignal,
  ): Promise<{ rows: Task[]; count: number }> {
    let query = db()
      .from('tasks')
      .select(taskFields, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range(page * 20, page * 20 + 19);
    if (siteId) query = query.eq('site_id', siteId);
    const response = await query.abortSignal(signal!);
    return { rows: result(response) ?? [], count: response.count ?? 0 };
  },
  async task(id: string, signal?: AbortSignal): Promise<Task> {
    return row(
      await db().from('tasks').select(taskFields).eq('id', id).abortSignal(signal!).single(),
    );
  },
  async history(
    id: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<{ rows: HistoryEntry[]; count: number }> {
    const response = await db()
      .from('task_history')
      .select(
        'id,task_id,actor_id,from_status,to_status,comment,created_at,actor:profiles!task_history_actor_id_fkey(full_name)',
        { count: 'exact' },
      )
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * 20, page * 20 + 19)
      .abortSignal(signal!);
    return { rows: result(response) ?? [], count: response.count ?? 0 };
  },
  async saveSite(values: Pick<Site, 'name' | 'address'>, id?: string): Promise<Site> {
    const query = id
      ? db().from('sites').update(values).eq('id', id)
      : db().from('sites').insert(values);
    return row(await query.select(siteFields).single());
  },
  async saveTask(
    values: Pick<Task, 'title' | 'description' | 'site_id' | 'assignee_id'>,
    id?: string,
  ): Promise<Task> {
    const query = id
      ? db().from('tasks').update(values).eq('id', id)
      : db().from('tasks').insert(values);
    return row(await query.select(taskFields).single());
  },
  async transition(task: Task, next: Status, comment: string) {
    return result(
      await db().rpc('transition_task', {
        p_task_id: task.id,
        p_expected_status: task.status,
        p_next_status: next,
        p_comment: comment,
      }),
    );
  },
  async deleteTask(id: string) {
    result(await db().rpc('delete_task', { p_task_id: id }));
  },
  async deleteSite(id: string) {
    result(await db().rpc('delete_site', { p_site_id: id }));
  },
};
