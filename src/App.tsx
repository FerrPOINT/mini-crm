import { useEffect, useState, type FormEvent } from 'react';
import { HashRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Building2, ClipboardList, HardHat } from 'lucide-react';
import {
  AccountMenu,
  AppShell,
  AppHeader,
  ThemeToggle,
  Button,
  Input,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Notice,
  LoadingState,
  ErrorState,
  EmptyState,
} from './ui';
import { db, configured } from './supabase';
import { api } from './api';
import { roleLabels } from './domain';
import { ProfileContext, useProfile } from './session';
import { SitesPage, SitePage, TasksPage, TaskPage } from './pages';
import { createQueryClient } from './query-client';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    const {
      data: { subscription },
    } = db().auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setReady(true);
      }
    });
    void db()
      .auth.getSession()
      .then(({ data, error }) => {
        if (active) {
          setSessionError(error?.message ?? null);
          setSession(data.session);
          setReady(true);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!configured)
    return (
      <div className="login-page">
        <Card>
          <CardHeader>
            <CardTitle>Приложение ещё не подключено</CardTitle>
          </CardHeader>
          <CardContent>
            <Notice>Настройте адрес Supabase и публичный ключ в окружении приложения.</Notice>
          </CardContent>
        </Card>
      </div>
    );
  if (!ready) return <LoadingState message="Проверяем вход…" />;
  if (sessionError)
    return (
      <ErrorState message="Не удалось проверить вход" onRetry={() => window.location.reload()} />
    );
  return session ? <SignedIn key={session.user.id} session={session} /> : <Login />;
}

function Login() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { error: failure } = await db().auth.signInWithPassword({
        email: String(values.get('email')).trim(),
        password: String(values.get('password')),
      });
      if (failure)
        setError(
          failure.status === 400
            ? 'Проверьте email и пароль.'
            : 'Сервис входа недоступен. Попробуйте ещё раз.',
        );
    } catch {
      setError('Не удалось подключиться. Проверьте соединение.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <Card className="login-card">
        <CardHeader>
          <div className="brand-line">
            <Building2 size={30} aria-hidden />
            <span>СТРОЙКА</span>
          </div>
          <CardTitle>Объекты и задачи</CardTitle>
          <CardDescription>Войдите в рабочий кабинет</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="form-stack">
            <FormField id="email" label="Email" required>
              {(attrs) => (
                <Input
                  {...attrs}
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.ru"
                  disabled={pending}
                />
              )}
            </FormField>
            <FormField id="password" label="Пароль" required>
              {(attrs) => (
                <Input
                  {...attrs}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={pending}
                />
              )}
            </FormField>
            {error && (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? 'Входим…' : 'Войти'}
            </Button>
            <p className="muted">
              Доступ выдаёт руководитель. Самостоятельная регистрация закрыта.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SignedIn({ session }: { session: Session }) {
  const [client] = useState(createQueryClient);
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return (
    <QueryClientProvider client={client}>
      <HashRouter>
        <ProfileGate id={session.user.id} />
      </HashRouter>
    </QueryClientProvider>
  );
}

function ProfileGate({ id }: { id: string }) {
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: ({ signal }) => api.profile(id, signal),
  });
  if (profile.isPending) return <LoadingState message="Открываем рабочий кабинет…" />;
  if (profile.isError)
    return (
      <div className="login-page">
        <Card>
          <CardContent>
            <ErrorState
              message="Не удалось получить профиль. Если доступ ещё не выдан, обратитесь к руководителю."
              onRetry={() => void profile.refetch()}
            />
            <Button onClick={() => void db().auth.signOut()}>Выйти</Button>
          </CardContent>
        </Card>
      </div>
    );
  return (
    <ProfileContext.Provider value={profile.data}>
      <Routes>
        <Route element={<Shell />}>
          <Route
            index
            element={
              <Navigate to={profile.data.role === 'executor' ? '/my-tasks' : '/sites'} replace />
            }
          />
          <Route path="sites" element={<SitesPage />} />
          <Route path="sites/:siteId" element={<SitePage />} />
          <Route path="tasks/:taskId" element={<TaskPage />} />
          <Route
            path="my-tasks"
            element={
              profile.data.role === 'executor' ? <TasksPage /> : <Navigate to="/sites" replace />
            }
          />
          <Route
            path="*"
            element={
              <EmptyState
                message="Страница не найдена"
                action={
                  <Button asChild>
                    <Link to="/">На главную</Link>
                  </Button>
                }
              />
            }
          />
        </Route>
      </Routes>
    </ProfileContext.Provider>
  );
}

function Shell() {
  const profile = useProfile();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigation = [
    { to: '/sites', label: 'Объекты', icon: Building2 },
    ...(profile.role === 'executor'
      ? [{ to: '/my-tasks', label: 'Мои задачи', icon: ClipboardList }]
      : []),
  ];
  async function logout() {
    setLoggingOut(true);
    const { error } = await db().auth.signOut();
    if (error) {
      setLogoutError('Не удалось выйти. Повторите попытку.');
      setLoggingOut(false);
    }
  }
  return (
    <AppShell
      title="Стройка"
      navigation={navigation}
      collapsibleSidebar
      renderHeader={(trigger) => (
        <AppHeader
          leading={
            <>
              {trigger}
              <HardHat size={24} aria-hidden />
              <strong>Стройка</strong>
            </>
          }
          actions={
            <AccountMenu
              account={{
                label: profile.full_name,
                secondary: roleLabels[profile.role],
                onLogout: () => void logout(),
                pending: loggingOut,
              }}
            />
          }
        />
      )}
    >
      {logoutError && (
        <Notice tone="danger" role="alert">
          {logoutError}
        </Notice>
      )}
      <div className="workspace">
        <Outlet />
      </div>
    </AppShell>
  );
}
