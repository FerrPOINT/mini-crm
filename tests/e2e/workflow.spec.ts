import {
  test,
  expect,
  checked,
  choose,
  credentials,
  openTask,
  signIn,
  taskStatus,
} from './fixtures';

test('AUTH: invalid credentials, session reload, logout and role isolation', async ({
  page,
  crm,
}) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(credentials('manager').email);
  await page
    .getByRole('textbox', { name: 'Пароль', exact: true })
    .fill('Incorrect-password-for-test');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Проверьте email и пароль');
  await signIn(page, 'manager');
  await expect(page.getByRole('button', { name: 'Новый объект', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Новый объект', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await signIn(page, 'executor2');
  await expect(page.getByRole('button', { name: 'Новый объект', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Аккаунт' })).toContainText(
    crm.accounts.executor2.profile.full_name,
  );
  await page.keyboard.press('Escape');
});

test('FLOW: create, edit, assign, rework, accept and delete through UI', async ({ crm, roles }) => {
  test.setTimeout(120_000);
  const manager = await roles.open('manager');
  const executor = await roles.open('executor1');
  const foreign = await roles.open('executor2');
  const name = `${crm.prefix} Стройка`;
  const title = `${crm.prefix} Проверить перекрытие`;
  const revised = `${name} — корпус Б`;

  await test.step('Manager creates and edits a site', async () => {
    await manager.goto('/#/sites');
    await manager.getByRole('button', { name: 'Новый объект', exact: true }).click();
    const form = manager.getByRole('dialog', { name: 'Новый объект', exact: true });
    await form.getByRole('textbox', { name: 'Название', exact: true }).fill(name);
    await form
      .getByRole('textbox', { name: 'Адрес', exact: true })
      .fill('Новосибирск, Строительная, 10');
    const saved = manager.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith('/rest/v1/sites') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const response = await saved;
    const site = await response.json();
    crm.siteIds.push(site.id);
    expect(response.ok()).toBe(true);
    await expect(form).toBeHidden();
    await manager.getByRole('link', { name, exact: true }).click();
    await expect(manager.getByText('Задач пока нет', { exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await manager.getByRole('textbox', { name: 'Название', exact: true }).fill(revised);
    await manager.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(manager.getByRole('heading', { name: revised, exact: true })).toBeVisible();
  });

  let taskId = '';
  await test.step('Manager creates a task using the searchable executor picker', async () => {
    await manager.getByRole('button', { name: 'Новая задача', exact: true }).click();
    const form = manager.getByRole('dialog', { name: 'Новая задача', exact: true });
    await form.getByRole('textbox', { name: 'Название', exact: true }).fill(title);
    await form
      .getByRole('textbox', { name: 'Описание', exact: true })
      .fill('Проверить уровень.\nПриложить результат при сдаче.');
    await expect(form.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
    await choose(manager, 'Исполнитель', crm.accounts.executor1.profile.full_name);
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(form).toBeHidden();
    await manager.getByRole('link', { name: title, exact: true }).click();
    taskId = new URL(manager.url()).hash.split('/').at(-1)!;
    await taskStatus(manager, 'Новая');
    await expect(manager.locator('.history-list li')).toHaveCount(1);
    await expect(manager.locator('.history-list li')).toContainText(
      crm.accounts.manager.profile.full_name,
    );
    await expect(manager.getByRole('button', { name: 'Взять в работу', exact: true })).toHaveCount(
      0,
    );
  });

  await test.step('Only the assigned executor can start and submit the task', async () => {
    await foreign.goto(`/#/tasks/${taskId}`);
    await expect(foreign.getByRole('alert')).toContainText('Задача не найдена или недоступна');
    await executor.goto('/#/my-tasks');
    await executor.getByRole('link', { name: title, exact: true }).click();
    await expect(executor.getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(
      0,
    );
    await executor
      .getByRole('textbox', { name: 'Комментарий', exact: true })
      .fill('Начал проверку');
    await executor.getByRole('button', { name: 'Взять в работу', exact: true }).click();
    await taskStatus(executor, 'В работе');
    await expect(executor.locator('.history-list li')).toHaveCount(2);
    await expect(executor.getByRole('textbox', { name: 'Комментарий', exact: true })).toHaveValue(
      '',
    );
    await executor.getByRole('button', { name: 'Отправить на проверку', exact: true }).click();
    await taskStatus(executor, 'На проверке');
    await expect(executor.getByRole('button', { name: 'Принять задачу', exact: true })).toHaveCount(
      0,
    );
  });

  await test.step('Rework requires a meaningful comment and appears in both histories', async () => {
    await manager.reload();
    await taskStatus(manager, 'На проверке');
    const rework = manager.getByRole('button', { name: 'Вернуть на доработку', exact: true });
    await expect(rework).toBeDisabled();
    await manager.getByRole('textbox', { name: 'Комментарий', exact: true }).fill('   ');
    await expect(rework).toBeDisabled();
    await manager
      .getByRole('textbox', { name: 'Комментарий', exact: true })
      .fill('Устранить перепад у двери');
    await rework.click();
    await taskStatus(manager, 'На доработке');
    await expect(manager.locator('.history-list li').first()).toContainText(
      'Устранить перепад у двери',
    );
    await executor.reload();
    await taskStatus(executor, 'На доработке');
    await expect(executor.locator('.history-list li').first()).toContainText(
      'Устранить перепад у двери',
    );
  });

  await test.step('Executor resubmits and manager accepts; terminal task has no status actions', async () => {
    await executor.getByRole('button', { name: 'Взять в работу', exact: true }).click();
    await taskStatus(executor, 'В работе');
    await executor.getByRole('button', { name: 'Отправить на проверку', exact: true }).click();
    await taskStatus(executor, 'На проверке');
    await manager.reload();
    await manager.getByRole('button', { name: 'Принять задачу', exact: true }).click();
    await taskStatus(manager, 'Принята');
    await expect(manager.locator('.history-list li')).toHaveCount(7);
    await executor.reload();
    await taskStatus(executor, 'Принята');
    await expect(executor.locator('.history-list li')).toHaveCount(7);
    await expect(executor.getByRole('textbox', { name: 'Комментарий', exact: true })).toHaveCount(
      0,
    );
    const history = checked(
      await crm.accounts.manager.client
        .from('task_history')
        .select('*')
        .eq('task_id', taskId)
        .order('id'),
    )!;
    expect(history.map((row) => row.to_status)).toEqual([
      'new',
      'in_progress',
      'in_review',
      'rework',
      'in_progress',
      'in_review',
      'accepted',
    ]);
    expect(history.every((row) => row.created_at && row.actor_id)).toBe(true);
  });

  await test.step('Deletion is confirmed, cancellation keeps data, deletion hides the task and site', async () => {
    await manager.getByRole('button', { name: 'Удалить', exact: true }).click();
    await manager
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Отмена', exact: true })
      .click();
    await expect(manager.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await manager.getByRole('button', { name: 'Удалить', exact: true }).click();
    await manager
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Удалить задачу', exact: true })
      .click();
    await expect(manager.getByRole('heading', { name: revised, exact: true })).toBeVisible();
    await expect(manager.getByText('Задач пока нет', { exact: true })).toBeVisible();
    await executor.reload();
    await expect(executor.getByRole('alert')).toContainText('Задача не найдена или недоступна');
    await manager.getByRole('button', { name: 'Удалить', exact: true }).click();
    await manager
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Отмена', exact: true })
      .click();
    await manager.getByRole('button', { name: 'Удалить', exact: true }).click();
    await manager
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Удалить объект', exact: true })
      .click();
    await expect(manager.getByRole('heading', { name: 'Объекты', exact: true })).toBeVisible();
    await expect(manager.getByRole('link', { name: revised, exact: true })).toHaveCount(0);
  });
});

test('EDIT: move and reassign a task without losing its status or history', async ({
  crm,
  roles,
}) => {
  const source = await crm.site('Источник');
  const target = await crm.site('Назначение');
  const task = await crm.task(source.id);
  await crm.transition(task.id, 'new', 'in_progress', 'executor1');
  const manager = await roles.open('manager');
  const oldExecutor = await roles.open('executor1');
  const newExecutor = await roles.open('executor2');
  await openTask(manager, task.id, task.title);
  await manager.getByRole('button', { name: 'Редактировать', exact: true }).click();
  const title = `${crm.prefix} Обновлённая задача`;
  await manager.getByRole('textbox', { name: 'Название', exact: true }).fill(title);
  await manager
    .getByRole('textbox', { name: 'Описание', exact: true })
    .fill('Новое описание\nСо второй строкой');
  await choose(manager, 'Объект', target.name);
  await choose(manager, 'Исполнитель', crm.accounts.executor2.profile.full_name);
  await manager.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(manager.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await taskStatus(manager, 'В работе');
  await expect(manager.getByRole('link', { name: target.name, exact: true })).toBeVisible();
  await expect(manager.locator('.task-description').first()).toHaveText(
    'Новое описание\nСо второй строкой',
  );
  await oldExecutor.goto(`/#/tasks/${task.id}`);
  await expect(oldExecutor.getByRole('alert')).toContainText('Задача не найдена или недоступна');
  await oldExecutor.goto(`/#/sites/${source.id}`);
  await expect(oldExecutor.getByRole('alert')).toContainText('Объект не найден или недоступен');
  await openTask(newExecutor, task.id, title);
  await expect(newExecutor.locator('.history-list li')).toHaveCount(2);
  await expect(newExecutor.locator('.history-list')).toContainText(
    crm.accounts.executor1.profile.full_name,
  );
  await expect(
    newExecutor.getByRole('button', { name: 'Отправить на проверку', exact: true }),
  ).toBeVisible();
  await expect(newExecutor.getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(
    0,
  );
});
