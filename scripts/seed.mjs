import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_SCRIPT_URL ?? process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !adminKey)
  throw new Error(
    'Set SUPABASE_SCRIPT_URL and SUPABASE_SERVICE_ROLE_KEY in the private environment.',
  );
const admin = createClient(url, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authAdmin = process.env.SUPABASE_ADMIN_AUTH_URL ? null : admin;
async function adminAuth(path, body) {
  const response = await fetch(`${process.env.SUPABASE_ADMIN_AUTH_URL}/admin/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Auth provisioning failed (${response.status})`);
  return response.json();
}
function checked(response) {
  if (response.error) throw response.error;
  return response.data;
}
const accounts = [
  {
    email: 'manager@mini-crm.example',
    full_name: 'Анна Ковалева',
    role: 'manager',
    password: process.env.DEMO_MANAGER_PASSWORD,
  },
  {
    email: 'executor1@mini-crm.example',
    full_name: 'Иван Петров',
    role: 'executor',
    password: process.env.DEMO_EXECUTOR1_PASSWORD,
  },
  {
    email: 'executor2@mini-crm.example',
    full_name: 'Сергей Волков',
    role: 'executor',
    password: process.env.DEMO_EXECUTOR2_PASSWORD,
  },
];
const existingUsers = process.env.SUPABASE_ADMIN_AUTH_URL
  ? await fetch(`${process.env.SUPABASE_ADMIN_AUTH_URL}/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error('Cannot inspect existing users');
      return (await response.json()).users;
    })
  : checked(await authAdmin.auth.admin.listUsers({ perPage: 1000 })).users;
for (const account of accounts) {
  if (!account.password || account.password.length < 12)
    throw new Error(`Set a password of at least 12 characters for ${account.email}`);
  let user = existingUsers.find((user) => user.email === account.email);
  if (!user)
    user = process.env.SUPABASE_ADMIN_AUTH_URL
      ? await adminAuth('users', {
          email: account.email,
          password: account.password,
          email_confirm: true,
        })
      : checked(
          await authAdmin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
          }),
        ).user;
  account.id = user.id;
  checked(
    await admin
      .from('profiles')
      .upsert({ id: user.id, full_name: account.full_name, role: account.role }),
  );
}
const existing = checked(await admin.from('sites').select('id').limit(1));
if (existing.length) {
  console.log('Accounts checked. Existing CRM records preserved; demo seed skipped.');
  process.exit(0);
}
const sites = checked(
  await admin
    .from('sites')
    .insert([
      { name: 'ЖК «Северный парк»', address: 'Новосибирск, ул. Дуси Ковальчук, 252' },
      { name: 'Офис на Красном', address: 'Новосибирск, Красный проспект, 86' },
      { name: 'Склад «Восточный»', address: 'Новосибирск, ул. Гаранина, 15' },
    ])
    .select(),
);
const tasks = checked(
  await admin
    .from('tasks')
    .insert([
      {
        title: 'Проверить разметку перегородок',
        description:
          'Сверить разметку на втором этаже с проектом. Зафиксировать отклонения перед началом кладки.',
        site_id: sites[0].id,
        assignee_id: accounts[1].id,
        author_id: accounts[0].id,
      },
      {
        title: 'Смонтировать кабельные лотки',
        description: 'Коридор первого этажа. Крепление по согласованной схеме.',
        site_id: sites[0].id,
        assignee_id: accounts[1].id,
        author_id: accounts[0].id,
      },
      {
        title: 'Подготовить стены под покраску',
        description: 'Переговорная, 3 этаж. Проверить плоскость и устранить неровности.',
        site_id: sites[1].id,
        assignee_id: accounts[2].id,
        author_id: accounts[0].id,
      },
      {
        title: 'Установить светильники',
        description: 'Заменить временное освещение в зоне приёмки.',
        site_id: sites[2].id,
        assignee_id: accounts[2].id,
        author_id: accounts[0].id,
      },
      {
        title: 'Устранить замечания по стяжке',
        description: 'Исправить перепад уровня у входной группы.',
        site_id: sites[1].id,
        assignee_id: accounts[1].id,
        author_id: accounts[0].id,
      },
    ])
    .select(),
);
const clients = [];
for (const account of accounts) {
  const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  checked(
    await client.auth.signInWithPassword({ email: account.email, password: account.password }),
  );
  clients.push(client);
}
async function move(index, actor, from, to, comment = '') {
  checked(
    await clients[actor].rpc('transition_task', {
      p_task_id: tasks[index].id,
      p_expected_status: from,
      p_next_status: to,
      p_comment: comment,
    }),
  );
}
await move(1, 1, 'new', 'in_progress');
await move(2, 2, 'new', 'in_progress');
await move(2, 2, 'in_progress', 'in_review');
await move(3, 2, 'new', 'in_progress');
await move(3, 2, 'in_progress', 'in_review');
await move(3, 0, 'in_review', 'accepted', 'Освещение проверено, замечаний нет.');
await move(4, 1, 'new', 'in_progress');
await move(4, 1, 'in_progress', 'in_review');
await move(
  4,
  0,
  'in_review',
  'rework',
  'У входа остался перепад 8 мм. Выровнять участок и повторно проверить уровнем.',
);
await Promise.all(clients.map((client) => client.auth.signOut({ scope: 'local' })));
console.log(
  'Created 3 accounts, 3 sites and 5 tasks in all 5 statuses. Passwords remain in the private environment.',
);
