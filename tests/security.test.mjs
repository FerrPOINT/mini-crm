import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_SCRIPT_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !adminKey) throw new Error('Test environment is incomplete');
const create = (apiKey) =>
  createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = create(adminKey),
  manager = create(key),
  executor1 = create(key),
  executor2 = create(key),
  anonymous = create(key);
const fixture = { sites: [], tasks: [] };
let managerId, executor1Id, executor2Id;
function checked(response) {
  assert.equal(response.error, null, response.error?.message);
  return response.data;
}
async function denied(query) {
  const response = await query;
  assert.ok(response.error, 'A direct prohibited request must fail');
  return response;
}
async function makeTask(
  assignee = executor1Id,
  site = fixture.sites[0],
  title = 'Проверка доступа',
) {
  const data = checked(
    await manager
      .from('tasks')
      .insert({ title, description: '', site_id: site, assignee_id: assignee })
      .select()
      .single(),
  );
  fixture.tasks.push(data.id);
  return data;
}
async function transition(client, taskId, from, to, comment = '') {
  return client.rpc('transition_task', {
    p_task_id: taskId,
    p_expected_status: from,
    p_next_status: to,
    p_comment: comment,
  });
}
before(async () => {
  for (const [client, email, password] of [
    [manager, 'manager@mini-crm.example', process.env.DEMO_MANAGER_PASSWORD],
    [executor1, 'executor1@mini-crm.example', process.env.DEMO_EXECUTOR1_PASSWORD],
    [executor2, 'executor2@mini-crm.example', process.env.DEMO_EXECUTOR2_PASSWORD],
  ])
    checked(await client.auth.signInWithPassword({ email, password }));
  managerId = checked(await manager.auth.getUser()).user.id;
  executor1Id = checked(await executor1.auth.getUser()).user.id;
  executor2Id = checked(await executor2.auth.getUser()).user.id;
  for (let index = 0; index < 3; index++)
    fixture.sites.push(
      checked(
        await manager
          .from('sites')
          .insert({ name: `QA ${randomUUID()}`, address: 'Тестовый адрес' })
          .select()
          .single(),
      ).id,
    );
});
after(async () => {
  if (fixture.tasks.length) {
    checked(await admin.from('task_history').delete().in('task_id', fixture.tasks));
    checked(await admin.from('tasks').delete().in('id', fixture.tasks));
  }
  if (fixture.sites.length) checked(await admin.from('sites').delete().in('id', fixture.sites));
  await Promise.all(
    [manager, executor1, executor2].map((client) => client.auth.signOut({ scope: 'local' })),
  );
});

test('anonymous cannot read CRM data or call commands; open signup is disabled', async () => {
  for (const table of ['profiles', 'sites', 'tasks', 'task_history'])
    await denied(anonymous.from(table).select('*'));
  await denied(anonymous.rpc('delete_site', { p_site_id: fixture.sites[0] }));
  await denied(
    anonymous.auth.signUp({
      email: `qa-${randomUUID()}@example.test`,
      password: 'Unregistered-user-Password-123',
    }),
  );
});

test('RLS isolates tasks, objects, profiles and history for two executors', async () => {
  const own = await makeTask(),
    foreign = await makeTask(executor2Id, fixture.sites[1]);
  assert.equal(checked(await executor1.from('tasks').select('id').eq('id', foreign.id)).length, 0);
  assert.equal(checked(await executor2.from('tasks').select('id').eq('id', own.id)).length, 0);
  assert.equal(
    checked(await executor1.from('task_history').select('id').eq('task_id', foreign.id)).length,
    0,
  );
  assert.equal(
    checked(await executor1.from('sites').select('id').eq('id', fixture.sites[1])).length,
    0,
  );
  assert.equal(
    checked(await executor1.from('sites').select('id').eq('id', fixture.sites[0])).length,
    1,
  );
  assert.equal(
    checked(await executor1.from('sites').select('id').eq('id', fixture.sites[2])).length,
    0,
  );
  assert.equal(checked(await executor1.from('tasks').select('id').eq('id', own.id)).length, 1);
  assert.equal(
    checked(await executor1.from('profiles').select('id').eq('id', executor2Id)).length,
    0,
  );
  assert.equal(
    checked(await manager.from('tasks').select('id').in('id', [own.id, foreign.id])).length,
    2,
  );
});

test('executor cannot edit fields, reassign, create, delete or elevate their profile', async () => {
  const task = await makeTask();
  const response = await executor1
    .from('tasks')
    .update({ title: 'Подмена', assignee_id: executor2Id })
    .eq('id', task.id)
    .select();
  assert.ok(response.error || response.data.length === 0);
  assert.equal(
    checked(await manager.from('tasks').select('title,assignee_id').eq('id', task.id).single())
      .assignee_id,
    executor1Id,
  );
  await denied(
    executor1
      .from('tasks')
      .insert({ title: 'Нельзя', site_id: fixture.sites[0], assignee_id: executor1Id }),
  );
  await denied(executor1.from('sites').insert({ name: 'Нельзя', address: 'Нельзя' }));
  await denied(executor1.from('profiles').update({ role: 'manager' }).eq('id', executor1Id));
  await denied(executor1.rpc('delete_task', { p_task_id: task.id }));
  await denied(executor1.rpc('delete_site', { p_site_id: fixture.sites[0] }));
});

test('all six permitted transitions and authoritative audit attribution', async () => {
  const task = await makeTask();
  checked(await transition(executor1, task.id, 'new', 'in_progress', 'Начинаю'));
  checked(await transition(executor1, task.id, 'in_progress', 'in_review'));
  for (const blank of [null, '', '   ', '\t\n\r '])
    await denied(transition(manager, task.id, 'in_review', 'rework', blank));
  checked(await transition(manager, task.id, 'in_review', 'rework', ' \tИсправить крепления\r\n'));
  checked(await transition(executor1, task.id, 'rework', 'in_progress'));
  checked(await transition(executor1, task.id, 'in_progress', 'in_review'));
  checked(await transition(manager, task.id, 'in_review', 'accepted'));
  const history = checked(
    await executor1.from('task_history').select('*').eq('task_id', task.id).order('id'),
  );
  assert.equal(history.length, 7);
  assert.deepEqual(
    history.map((entry) => entry.to_status),
    ['new', 'in_progress', 'in_review', 'rework', 'in_progress', 'in_review', 'accepted'],
  );
  assert.equal(history[0].actor_id, managerId);
  assert.equal(history[1].actor_id, executor1Id);
  assert.equal(history[3].actor_id, managerId);
  assert.equal(history[3].comment, 'Исправить крепления');
  await denied(transition(executor1, task.id, 'accepted', 'in_progress'));
  await denied(transition(manager, task.id, 'accepted', 'new'));
});

test('every forbidden role/status pair is rejected through RPC', async () => {
  const statuses = ['new', 'in_progress', 'in_review', 'accepted', 'rework'];
  for (const [actor, actorRole] of [
    [manager, 'manager'],
    [executor1, 'executor'],
    [executor2, 'foreign'],
  ]) {
    for (const from of statuses) {
      const task = await makeTask();
      const path = {
        new: [],
        in_progress: ['in_progress'],
        in_review: ['in_progress', 'in_review'],
        accepted: ['in_progress', 'in_review', 'accepted'],
        rework: ['in_progress', 'in_review', 'rework'],
      }[from];
      let current = 'new';
      for (const next of path) {
        checked(
          await transition(
            next === 'accepted' || next === 'rework' ? manager : executor1,
            task.id,
            current,
            next,
            'QA',
          ),
        );
        current = next;
      }
      for (const to of statuses) {
        const allowed =
          actorRole === 'manager'
            ? from === 'in_review' && ['accepted', 'rework'].includes(to)
            : actorRole === 'executor' &&
              ((['new', 'rework'].includes(from) && to === 'in_progress') ||
                (from === 'in_progress' && to === 'in_review'));
        if (!allowed) await denied(transition(actor, task.id, from, to, 'QA'));
      }
    }
  }
});

test('direct writes cannot bypass status, identity or history rules, even as manager', async () => {
  const task = await makeTask();
  for (const actor of [executor1, manager]) {
    await denied(actor.from('tasks').update({ status: 'accepted' }).eq('id', task.id));
    await denied(
      actor
        .from('tasks')
        .update({ author_id: executor2Id, created_at: '2000-01-01' })
        .eq('id', task.id),
    );
    await denied(
      actor.from('tasks').insert({
        title: 'Forged',
        site_id: fixture.sites[0],
        assignee_id: executor1Id,
        status: 'accepted',
        author_id: executor2Id,
      }),
    );
    await denied(
      actor
        .from('task_history')
        .insert({ task_id: task.id, actor_id: executor2Id, to_status: 'accepted' }),
    );
    await denied(actor.from('task_history').update({ comment: 'Forged' }).eq('task_id', task.id));
    await denied(actor.from('task_history').delete().eq('task_id', task.id));
    await denied(actor.from('tasks').delete().eq('id', task.id));
  }
  await denied(
    manager
      .from('tasks')
      .insert({ title: 'Bad assignee', site_id: fixture.sites[0], assignee_id: managerId }),
  );
  assert.equal(
    checked(await manager.from('task_history').select('id').eq('task_id', task.id)).length,
    1,
  );
});

test('concurrent duplicate transitions write one history event; stale requests fail', async () => {
  const task = await makeTask();
  const started = performance.now();
  const responses = await Promise.all([
    transition(executor1, task.id, 'new', 'in_progress'),
    transition(executor1, task.id, 'new', 'in_progress'),
  ]);
  assert.equal(responses.filter((response) => !response.error).length, 1);
  const failure = responses.find((response) => response.error);
  assert.equal(failure?.error?.code, 'PT409');
  assert.ok(
    performance.now() - started < 5000,
    'Business conflicts must fail promptly without database retry loops',
  );
  assert.equal(
    checked(await manager.from('task_history').select('id').eq('task_id', task.id)).length,
    2,
  );
  assert.equal(
    (await denied(transition(executor1, task.id, 'new', 'in_review'))).error.code,
    'PT409',
  );
});

test('reassignment transfers visibility and history; deletion hides data but preserves audit', async () => {
  const task = await makeTask();
  checked(await transition(executor1, task.id, 'new', 'in_progress'));
  checked(await manager.from('tasks').update({ assignee_id: executor2Id }).eq('id', task.id));
  assert.equal(checked(await executor1.from('tasks').select('id').eq('id', task.id)).length, 0);
  assert.equal(
    checked(await executor1.from('task_history').select('id').eq('task_id', task.id)).length,
    0,
  );
  assert.equal(
    checked(await executor2.from('task_history').select('id').eq('task_id', task.id)).length,
    2,
  );
  assert.equal(
    checked(await executor2.from('profiles').select('id').eq('id', executor1Id)).length,
    1,
  );
  checked(await manager.rpc('delete_task', { p_task_id: task.id }));
  assert.equal(checked(await manager.from('tasks').select('id').eq('id', task.id)).length, 0);
  assert.equal(
    checked(await admin.from('task_history').select('id').eq('task_id', task.id)).length,
    2,
  );
  await denied(transition(executor2, task.id, 'in_progress', 'in_review'));
  const siteTask = await makeTask(executor1Id, fixture.sites[2]);
  checked(await manager.rpc('delete_site', { p_site_id: fixture.sites[2] }));
  assert.equal(checked(await manager.from('tasks').select('id').eq('id', siteTask.id)).length, 0);
  await denied(
    manager
      .from('tasks')
      .insert({ title: 'Deleted site', site_id: fixture.sites[2], assignee_id: executor1Id }),
  );
});
