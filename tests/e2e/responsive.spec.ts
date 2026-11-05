import { test, expect, checked, choose } from './fixtures';

test('MOBILE-LIST: complete task cards fit narrow screens and resize back to a table', async ({
  crm,
  roles,
}, testInfo) => {
  test.setTimeout(120_000);
  const site = await crm.site('Объект с длинным названием для мобильного списка');
  const task = await crm.task(
    site.id,
    'executor1',
    'СогласоватьОченьДлинноеНазваниеСтроительнойРаботыБезПробелов'.repeat(2),
  );
  const foreign = await crm.task(site.id, 'executor2', 'Чужая работа');
  const page = await roles.open('executor1');
  for (const width of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/#/my-tasks', `/#/sites/${site.id}`]) {
      await page.goto(route);
      const title = page.getByRole('link', { name: task.title, exact: true });
      await expect(title).toBeVisible();
      await expect(page.getByRole('link', { name: foreign.title, exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width < 768) {
        await expect(page.getByRole('table')).toHaveCount(0);
        const card = page
          .getByRole('list', { name: 'Задачи', exact: true })
          .getByRole('listitem')
          .filter({ has: title });
        await expect(card.getByText('Новая', { exact: true })).toBeVisible();
        await expect(card.locator('time')).toBeVisible();
        await expect(
          card.getByText(
            route.includes('my-tasks') ? site.name : crm.accounts.executor1.profile.full_name,
            { exact: true },
          ),
        ).toBeVisible();
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        const box = await title.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        if (width === 390 && route.includes('my-tasks')) {
          await page.screenshot({
            path: testInfo.outputPath('mobile-my-tasks.png'),
            fullPage: true,
          });
        }
      } else {
        await expect(page.getByRole('table')).toBeVisible();
        await expect(page.getByRole('list', { name: 'Задачи', exact: true })).toHaveCount(0);
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/#/my-tasks');
  await page.getByRole('link', { name: task.title, exact: true }).click();
  await expect(page.getByRole('heading', { name: task.title, exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: 'Взять в работу', exact: true });
  const box = await start.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await start.click();
  await expect(
    page.getByRole('button', { name: 'Отправить на проверку', exact: true }),
  ).toBeVisible();
});

test('MOBILE-FORM: narrow short viewport keeps task creation readable and reachable', async ({
  crm,
  roles,
}, testInfo) => {
  const site = await crm.site();
  const page = await roles.open('manager');
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto(`/#/sites/${site.id}`);
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Новая задача', exact: true });
  const input = form.getByRole('textbox', { name: 'Название', exact: true });
  expect(
    await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const title = `${crm.prefix} Создана с телефона`;
  await input.fill(title);
  await choose(page, 'Исполнитель', crm.accounts.executor1.profile.full_name);
  expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const close = await form.getByRole('button', { name: 'Закрыть', exact: true }).boundingBox();
  const heading = await form
    .getByRole('heading', { name: 'Новая задача', exact: true })
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const box = range.getBoundingClientRect();
      return { right: box.right };
    });
  expect(heading.right).toBeLessThanOrEqual(close!.x);
  const save = form.getByRole('button', { name: 'Сохранить', exact: true });
  await save.scrollIntoViewIfNeeded();
  const saveBox = await save.boundingBox();
  expect(saveBox!.height).toBeGreaterThanOrEqual(44);
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(480);
  expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('mobile-task-form.png') });
  await save.click();
  await expect(form).toBeHidden();
  await expect(
    page
      .getByRole('list', { name: 'Задачи', exact: true })
      .getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
  expect(
    checked(await crm.accounts.manager.client.from('tasks').select('id').eq('site_id', site.id)),
  ).toHaveLength(1);
});
