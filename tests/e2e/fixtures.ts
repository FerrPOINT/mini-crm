import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import type { Database } from '../../src/database.types';

export type Actor = 'manager' | 'executor1' | 'executor2';
const actors: Actor[] = ['manager', 'executor1', 'executor2'];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing test environment: ${name}`);
  return value;
}

export function checked<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export function credentials(actor: Actor) {
  return {
    email: `${actor}@mini-crm.example`,
    password: required(`DEMO_${actor.toUpperCase()}_PASSWORD`),
  };
}

async function authenticate(baseURL: string) {
  const origin = new URL(baseURL).origin;
  const url = new URL(required('VITE_SUPABASE_URL'), origin).href.replace(/\/$/, '');
  const accounts = await Promise.all(
    actors.map(async (actor) => {
      const storage = new Map<string, string>();
      const client = createClient<Database>(url, required('VITE_SUPABASE_ANON_KEY'), {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => {
              storage.set(key, value);
            },
            removeItem: (key) => {
              storage.delete(key);
            },
          },
        },
      });
      // Fixture setup can use the installation's private Auth endpoint. UI login
      // still goes through Nginx, including its public brute-force protection.
      const privateAuth = process.env.SUPABASE_ADMIN_AUTH_URL;
      let auth;
      if (privateAuth) {
        const response = await fetch(`${privateAuth}/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: required('VITE_SUPABASE_ANON_KEY'),
          },
          body: JSON.stringify(credentials(actor)),
        });
        if (!response.ok)
          throw new Error(`Fixture sign-in failed for ${actor} (${response.status})`);
        auth = await client.auth.setSession(await response.json());
      } else {
        auth = await client.auth.signInWithPassword(credentials(actor));
      }
      if (auth.error) throw new Error(`Test sign-in failed for ${actor}: ${auth.error.message}`);
      const { user } = auth.data;
      if (!user) throw new Error(`No authenticated user: ${actor}`);
      const profile = checked(
        await client.from('profiles').select('*').eq('id', user.id).single(),
      )!;
      const account = {
        client,
        profile,
        storageState: {
          cookies: [],
          origins: [
            { origin, localStorage: [...storage].map(([name, value]) => ({ name, value })) },
          ],
        },
      };
      return [actor, account] as const;
    }),
  );
  return Object.fromEntries(accounts) as Record<Actor, (typeof accounts)[number][1]>;
}
type Accounts = Awaited<ReturnType<typeof authenticate>>;

function fixtures(accounts: Accounts, baseURL: string) {
  const prefix = `E2E ${randomUUID().slice(0, 8)}`;
  const siteIds: string[] = [];
  const admin = createClient<Database>(
    new URL(required('VITE_SUPABASE_URL'), baseURL).href.replace(/\/$/, ''),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return {
    prefix,
    accounts,
    siteIds,
    async site(suffix = 'Объект') {
      const id = randomUUID();
      siteIds.push(id);
      const site = checked(
        await accounts.manager.client.rpc('create_site', {
          p_id: id,
          p_name: `${prefix} ${suffix}`,
          p_address: 'Новосибирск, Тестовая, 1',
        }),
      )!;
      return site;
    },
    async task(siteId: string, actor: 'executor1' | 'executor2' = 'executor1', title = 'Монтаж') {
      return checked(
        await accounts.manager.client.rpc('create_task', {
          p_id: randomUUID(),
          p_title: `${prefix} ${title}`,
          p_description: 'Первая строка\nВторая строка',
          p_site_id: siteId,
          p_assignee_id: accounts[actor].profile.id,
        }),
      )!;
    },
    async transition(
      id: string,
      from: Database['public']['Enums']['task_status'],
      to: Database['public']['Enums']['task_status'],
      actor: Actor,
      comment = '',
    ) {
      return checked(
        await accounts[actor].client.rpc('transition_task', {
          p_task_id: id,
          p_expected_status: from,
          p_next_status: to,
          p_comment: comment,
        }),
      );
    },
    async cleanup() {
      if (!siteIds.length) return;
      // Exact IDs belong to this test, including rows soft-deleted through the UI.
      const tasks = checked(await admin.from('tasks').select('id').in('site_id', siteIds))!;
      if (tasks.length) {
        const ids = tasks.map(({ id }) => id);
        checked(await admin.from('task_history').delete().in('task_id', ids));
        checked(await admin.from('tasks').delete().in('id', ids));
      }
      checked(await admin.from('sites').delete().in('id', siteIds));
      expect(checked(await admin.from('sites').select('id').in('id', siteIds))).toEqual([]);
    },
  };
}
type Crm = ReturnType<typeof fixtures>;
type RolePages = { open: (actor: Actor) => Promise<Page> };

export const test = base.extend<{ crm: Crm; roles: RolePages }, { accounts: Accounts }>({
  accounts: [
    async ({}, use, workerInfo) => {
      const accounts = await authenticate(String(workerInfo.project.use.baseURL));
      await use(accounts);
      // Sessions remain in memory and vanish with the worker; no auth-state files.
    },
    { scope: 'worker' },
  ],
  crm: async ({ accounts, baseURL }, use) => {
    const crm = fixtures(accounts, baseURL!);
    try {
      await use(crm);
    } finally {
      await crm.cleanup();
    }
  },
  roles: async ({ browser, contextOptions, baseURL, accounts }, use) => {
    const contexts: BrowserContext[] = [];
    try {
      await use({
        open: async (actor) => {
          const context = await browser.newContext({
            ...contextOptions,
            baseURL,
            storageState: accounts[actor].storageState,
          });
          contexts.push(context);
          return context.newPage();
        },
      });
    } finally {
      for (const context of contexts) await context.close();
    }
  },
});

export { expect };

export async function signIn(page: Page, actor: Actor) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(credentials(actor).email);
  await page
    .getByRole('textbox', { name: 'Пароль', exact: true })
    .fill(credentials(actor).password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Аккаунт', exact: true })).toBeVisible();
}

export async function choose(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}:`) }).click();
  const picker = page.getByRole('dialog', { name: label, exact: true });
  await picker.getByRole('searchbox').fill(value);
  await picker.getByRole('button', { name: value, exact: true }).click();
  await expect(picker).toBeHidden();
}

export async function taskStatus(page: Page, status: string) {
  await expect(page.locator('.task-facts').getByText(status, { exact: true })).toBeVisible();
}

export async function openTask(page: Page, id: string, title: string) {
  await page.goto(`/#/tasks/${id}`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.history-list li').first()).toBeVisible();
}
