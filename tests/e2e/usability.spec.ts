import { test, expect, checked, choose, openTask, taskStatus } from './fixtures';

test('FORM: whitespace validation, cancel, nested picker and keyboard focus', async ({
  crm,
  roles,
}) => {
  const site = await crm.site();
  const page = await roles.open('manager');
  await page.goto(`/#/sites/${site.id}`);
  const edit = page.getByRole('button', { name: 'Редактировать', exact: true });
  await edit.click();
  const form = page.getByRole('dialog', { name: 'Редактировать объект', exact: true });
  await expect(form.getByRole('textbox', { name: 'Название', exact: true })).toBeFocused();
  await form.getByRole('textbox', { name: 'Название', exact: true }).fill('   ');
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Укажите название');
  await expect(form.getByRole('textbox', { name: 'Название', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await form.getByRole('textbox', { name: 'Название', exact: true }).fill(site.name);
  await form.getByRole('textbox', { name: 'Адрес', exact: true }).fill('   ');
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Укажите адрес');
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();
  await expect(edit).toBeFocused();
  await expect(page.getByRole('heading', { name: site.name, exact: true })).toBeVisible();
  expect(
    checked(
      await crm.accounts.manager.client
        .from('sites')
        .select('name,address')
        .eq('id', site.id)
        .single(),
    ),
  ).toMatchObject({ name: site.name, address: site.address });

  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  const taskForm = page.getByRole('dialog', { name: 'Новая задача', exact: true });
  await taskForm.getByRole('textbox', { name: 'Название', exact: true }).fill('   ');
  const pickerTrigger = page.getByRole('button', { name: /^Исполнитель:/ });
  await pickerTrigger.click();
  const picker = page.getByRole('dialog', { name: 'Исполнитель', exact: true });
  await picker.getByRole('searchbox').fill('Несуществующий пользователь 987');
  await expect(picker.getByRole('status')).toContainText('Ничего не найдено');
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(pickerTrigger).toBeFocused();
  await expect(taskForm).toBeVisible();
  await choose(page, 'Исполнитель', crm.accounts.executor1.profile.full_name);
  await taskForm.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(taskForm.getByRole('alert')).toContainText('Укажите название');
  await taskForm.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(taskForm).toBeHidden();
  await expect(page.getByRole('button', { name: 'Новая задача', exact: true })).toBeFocused();
  expect(
    checked(await crm.accounts.manager.client.from('tasks').select('id').eq('site_id', site.id)),
  ).toEqual([]);
});

test('LAYOUT: left back link, readable table, themes persist and mobile navigation closes', async ({
  crm,
  roles,
}) => {
  const site = await crm.site('Длинное название объекта для проверки интерфейса');
  const task = await crm.task(
    site.id,
    'executor1',
    'Проверить очень длинное название задачи и переносы строк',
  );
  const page = await roles.open('manager');
  await openTask(page, task.id, task.title);
  const back = page.getByRole('link', { name: 'К объекту', exact: true });
  const layout = await page.locator('.workspace').boundingBox();
  const backBox = await back.boundingBox();
  expect(layout && backBox).toBeTruthy();
  expect(Math.abs(backBox!.x - layout!.x)).toBeLessThan(2);
  expect(backBox!.width).toBeLessThan(180);
  const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
  expect(heading!.y - (backBox!.y + backBox!.height)).toBeLessThanOrEqual(8);
  await back.click();
  await expect(page.getByRole('heading', { name: site.name, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: task.title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize()!.width < 600) {
    const table = page.locator('.base-table-scroll');
    expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const titleCell = page.getByRole('cell', { name: task.title, exact: true });
    expect((await titleCell.boundingBox())!.width).toBeGreaterThan(150);
    await page.getByRole('button', { name: 'Открыть навигацию', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Основная навигация', exact: true });
    await drawer.getByRole('link', { name: 'Объекты', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Объекты', exact: true })).toBeVisible();
  }
  for (const [label, theme] of [
    ['Светлая', 'light'],
    ['Тёмная', 'dark'],
    ['Серая', 'gray'],
  ]) {
    await page.getByRole('button', { name: 'Аккаунт', exact: true }).click();
    await page.getByRole('menuitemradio', { name: label, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Аккаунт', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gray');
});

test('PAGES: tasks and history paginate at 20 without losing records', async ({ crm, roles }) => {
  const site = await crm.site();
  for (let index = 0; index < 21; index++) await crm.task(site.id, 'executor1', `Работа ${index}`);
  const page = await roles.open('manager');
  await page.goto(`/#/sites/${site.id}`);
  await expect(page.locator('tbody tr')).toHaveCount(20);
  const pages = page.getByRole('navigation', { name: 'Страницы списка', exact: true });
  await expect(pages).toContainText('1–20 из 21');
  const firstPage = await page.locator('tbody a').allTextContents();
  await pages.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(pages).toContainText('21–21 из 21');
  const lastTitle = await page.locator('tbody a').innerText();
  expect(firstPage).not.toContain(lastTitle);
  await expect(pages.getByRole('button', { name: 'Далее', exact: true })).toBeDisabled();
  await pages.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  expect(await page.locator('tbody a').allTextContents()).toEqual(firstPage);

  const task = await crm.task(site.id, 'executor1', 'Много доработок');
  await crm.transition(task.id, 'new', 'in_progress', 'executor1');
  for (let index = 0; index < 7; index++) {
    await crm.transition(task.id, 'in_progress', 'in_review', 'executor1');
    await crm.transition(task.id, 'in_review', 'rework', 'manager', `Замечание ${index}`);
    if (index < 6) await crm.transition(task.id, 'rework', 'in_progress', 'executor1');
  }
  await openTask(page, task.id, task.title);
  await expect(page.locator('.history-list li')).toHaveCount(20);
  await expect(pages).toContainText('1–20 из 22');
  await pages.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.history-list li')).toHaveCount(2);
  await expect(pages).toContainText('21–22 из 22');
  await expect(page.locator('.history-list li').last()).toContainText('Задача создана · Новая');
  await pages.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.locator('.history-list li')).toHaveCount(20);
  await expect(page.locator('.history-list li').first()).toContainText('Замечание 6');
});

test('STALE: conflict refreshes status and history without duplicating a transition', async ({
  crm,
  roles,
}) => {
  const site = await crm.site();
  const task = await crm.task(site.id);
  const page = await roles.open('executor1');
  await openTask(page, task.id, task.title);
  await taskStatus(page, 'Новая');
  // Another authenticated session commits while this card is still open.
  await crm.transition(task.id, 'new', 'in_progress', 'executor1', 'Из другой сессии');
  await page.getByRole('button', { name: 'Взять в работу', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Статус задачи изменился');
  await taskStatus(page, 'В работе');
  await expect(
    page.getByRole('button', { name: 'Отправить на проверку', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.history-list li')).toHaveCount(2);
  await expect(page.locator('.history-list li').first()).toContainText('Из другой сессии');
});

test('ERROR: network failures are explicit; retries keep the user input', async ({
  crm,
  roles,
}) => {
  const page = await roles.open('manager');
  await page.route('**/rest/v1/sites?*', (route) => route.abort(), { times: 1 });
  await page.goto('/#/sites');
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить объекты');
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Объекты', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Новый объект', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Новый объект', exact: true });
  const name = `${crm.prefix} Сохранение с ошибкой`;
  await form.getByRole('textbox', { name: 'Название', exact: true }).fill(name);
  await form.getByRole('textbox', { name: 'Адрес', exact: true }).fill('Тестовый адрес');
  await page.route(
    '**/rest/v1/sites?*',
    async (route) => {
      if (route.request().method() === 'POST') await route.abort();
      else await route.continue();
    },
    { times: 1 },
  );
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('textbox', { name: 'Название', exact: true })).toHaveValue(name);
  const saved = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith('/rest/v1/sites') && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const response = await saved;
  const [site] = await response.json();
  crm.siteIds.push(site.id);
  expect(response.ok()).toBe(true);
  await expect(form).toBeHidden();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
});

test('PENDING: slow save blocks duplicate submits and premature dialog dismissal', async ({
  crm,
  roles,
}) => {
  const site = await crm.site();
  const page = await roles.open('manager');
  await page.goto(`/#/sites/${site.id}`);
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Редактировать объект', exact: true });
  const name = `${site.name} Обновлён`;
  await form.getByRole('textbox', { name: 'Название', exact: true }).fill(name);
  let release!: () => void;
  let intercepted!: () => void;
  const waiting = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route('**/rest/v1/sites?*', async (route) => {
    if (route.request().method() === 'PATCH') {
      writes++;
      intercepted();
      await gate;
    }
    await route.continue();
  });
  try {
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await waiting;
    await expect(form.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeDisabled();
    await expect(form.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled();
    await expect(form.getByRole('textbox', { name: 'Название', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(form).toBeVisible();
  } finally {
    release();
  }
  await expect(form).toBeHidden();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

test('HISTORY: failed audit read can be retried independently of the task', async ({
  crm,
  roles,
}) => {
  const site = await crm.site();
  const task = await crm.task(site.id);
  const page = await roles.open('executor1');
  await page.route('**/rest/v1/task_history?*', (route) => route.abort(), { times: 1 });
  await page.goto(`/#/tasks/${task.id}`);
  await taskStatus(page, 'Новая');
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить историю');
  await expect(page.getByRole('button', { name: 'Взять в работу', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.locator('.history-list li')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
