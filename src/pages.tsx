import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, MapPin } from 'lucide-react';
import {
  ActionGroup,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ContentSection,
  ConfirmAction,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Textarea,
  TextLink,
} from './ui';
import { api } from './api';
import { availableActions, formatDate, statusLabels, type Status } from './domain';
import { useProfile } from './session';
import { SiteForm, TaskForm } from './forms';
import { Back, Pagination, StatusBadge, message } from './components';

export function SitesPage() {
  const profile = useProfile();
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const sites = useQuery({
    queryKey: ['sites', page],
    queryFn: ({ signal }) => api.sites(page, signal),
  });
  return (
    <>
      <PageHeader
        title="Объекты"
        context={
          profile.role === 'manager'
            ? 'Стройки и задачи вашей команды'
            : 'Объекты, на которых вам назначены задачи'
        }
        actions={
          profile.role === 'manager' && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} aria-hidden />
              Новый объект
            </Button>
          )
        }
      />
      {sites.isPending ? (
        <LoadingState />
      ) : sites.isError ? (
        <ErrorState message="Не удалось загрузить объекты" onRetry={() => void sites.refetch()} />
      ) : (
        <>
          {sites.data.rows.length === 0 ? (
            <EmptyState
              message="Объектов пока нет"
              description={
                profile.role === 'manager'
                  ? 'Создайте объект, чтобы поставить первые задачи.'
                  : 'Объекты появятся после назначения вам задач.'
              }
            />
          ) : (
            <div className="site-grid">
              {sites.data.rows.map((site) => (
                <Card key={site.id}>
                  <CardHeader>
                    <CardTitle>
                      <TextLink asChild>
                        <Link to={`/sites/${site.id}`}>{site.name}</Link>
                      </TextLink>
                    </CardTitle>
                    <CardDescription>
                      <MapPin size={16} aria-hidden /> {site.address}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline">
                      <Link to={`/sites/${site.id}`}>Открыть объект</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            count={sites.data.count}
            onPage={setPage}
            pending={sites.isFetching}
          />
        </>
      )}
      {creating && <SiteForm onClose={() => setCreating(false)} />}
    </>
  );
}

export function SitePage() {
  const { siteId = '' } = useParams();
  return <SiteDetails key={siteId} siteId={siteId} />;
}

function SiteDetails({ siteId }: { siteId: string }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const site = useQuery({
    queryKey: ['site', siteId],
    queryFn: ({ signal }) => api.site(siteId, signal),
  });
  const deletion = useMutation({
    mutationFn: () => api.deleteSite(siteId),
    onSuccess: () => navigate('/sites'),
  });
  if (site.isPending) return <LoadingState />;
  if (site.isError)
    return (
      <ErrorState message="Объект не найден или недоступен" onRetry={() => void site.refetch()} />
    );
  return (
    <>
      <div className="detail-heading">
        <Back to="/sites">Все объекты</Back>
        <PageHeader
          title={site.data.name}
          context={site.data.address}
          actions={
            profile.role === 'manager' && (
              <ActionGroup>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil size={16} aria-hidden />
                  Редактировать
                </Button>
                <ConfirmAction
                  title="Удалить объект?"
                  description="Объект и все его задачи исчезнут из рабочих списков. История сохранится в базе."
                  confirmLabel="Удалить объект"
                  confirmVariant="destructive"
                  variant="ghost"
                  isPending={deletion.isPending}
                  error={deletion.error ? message(deletion.error) : null}
                  onConfirm={() => deletion.mutateAsync()}
                >
                  Удалить
                </ConfirmAction>
              </ActionGroup>
            )
          }
        />
      </div>
      <ContentSection>
        <SectionHeader
          title="Задачи объекта"
          actions={
            profile.role === 'manager' && (
              <Button onClick={() => setCreatingTask(true)}>
                <Plus size={18} aria-hidden />
                Новая задача
              </Button>
            )
          }
        />
        <TaskList siteId={siteId} />
      </ContentSection>
      {editing && <SiteForm site={site.data} onClose={() => setEditing(false)} />}
      {creatingTask && <TaskForm site={site.data} onClose={() => setCreatingTask(false)} />}
    </>
  );
}

export function TasksPage() {
  return (
    <>
      <PageHeader title="Мои задачи" context="Назначенные вам работы на всех объектах" />
      <TaskList />
    </>
  );
}

function TaskList({ siteId }: { siteId?: string }) {
  const [page, setPage] = useState(0);
  const tasks = useQuery({
    queryKey: ['tasks', siteId ?? 'mine', page],
    queryFn: ({ signal }) => api.tasks(page, siteId, signal),
  });
  if (tasks.isPending) return <LoadingState scope="local" />;
  if (tasks.isError)
    return (
      <ErrorState
        scope="local"
        message="Не удалось загрузить задачи"
        onRetry={() => void tasks.refetch()}
      />
    );
  return (
    <>
      {tasks.data.rows.length === 0 ? (
        <EmptyState message="Задач пока нет" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>{siteId ? 'Исполнитель' : 'Объект'}</TableHead>
              <TableHead>Создана</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.data.rows.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <TextLink asChild>
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </TextLink>
                </TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  {siteId ? (
                    task.assignee?.full_name
                  ) : (
                    <TextLink asChild>
                      <Link to={`/sites/${task.site_id}`}>{task.site?.name}</Link>
                    </TextLink>
                  )}
                </TableCell>
                <TableCell>{formatDate(task.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination
        page={page}
        count={tasks.data.count}
        onPage={setPage}
        pending={tasks.isFetching}
      />
    </>
  );
}

export function TaskPage() {
  const { taskId = '' } = useParams();
  return <TaskDetails key={taskId} taskId={taskId} />;
}

function TaskDetails({ taskId }: { taskId: string }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [comment, setComment] = useState('');
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: ({ signal }) => api.task(taskId, signal),
  });
  const site = useQuery({
    queryKey: ['site', task.data?.site_id],
    queryFn: ({ signal }) => api.site(task.data!.site_id, signal),
    enabled: Boolean(task.data),
  });
  const history = useQuery({
    queryKey: ['history', taskId, historyPage],
    queryFn: ({ signal }) => api.history(taskId, historyPage, signal),
    enabled: Boolean(task.data),
  });
  const change = useMutation({
    mutationFn: (next: Status) => api.transition(task.data!, next, comment),
    onSuccess: () => {
      setComment('');
      setHistoryPage(0);
    },
    onError: async () => {
      await client.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
  const deletion = useMutation({
    mutationFn: () => api.deleteTask(taskId),
    onSuccess: () => navigate(`/sites/${task.data!.site_id}`),
  });
  if (task.isPending) return <LoadingState />;
  if (task.isError)
    return (
      <ErrorState message="Задача не найдена или недоступна" onRetry={() => void task.refetch()} />
    );
  const data = task.data;
  const actions = availableActions(data, profile);
  return (
    <>
      <div className="detail-heading">
        <Back to={`/sites/${data.site_id}`}>К объекту</Back>
        <PageHeader
          title={data.title}
          actions={
            profile.role === 'manager' && (
              <ActionGroup>
                <Button variant="outline" disabled={!site.data} onClick={() => setEditing(true)}>
                  Редактировать
                </Button>
                <ConfirmAction
                  title="Удалить задачу?"
                  description="Задача исчезнет из рабочих списков. История сохранится в базе."
                  confirmLabel="Удалить задачу"
                  confirmVariant="destructive"
                  variant="ghost"
                  isPending={deletion.isPending}
                  error={deletion.error ? message(deletion.error) : null}
                  onConfirm={() => deletion.mutateAsync()}
                >
                  Удалить
                </ConfirmAction>
              </ActionGroup>
            )
          }
        />
      </div>
      <div className="task-layout">
        <div className="form-stack">
          <Card>
            <CardHeader>
              <CardTitle>О задаче</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="task-facts">
                <div>
                  <dt>Статус</dt>
                  <dd>
                    <StatusBadge status={data.status} />
                  </dd>
                </div>
                <div>
                  <dt>Объект</dt>
                  <dd>
                    {site.isPending ? (
                      'Загружается…'
                    ) : site.isError ? (
                      <Button variant="link" onClick={() => void site.refetch()}>
                        Повторить загрузку
                      </Button>
                    ) : (
                      <TextLink asChild>
                        <Link to={`/sites/${data.site_id}`}>{site.data.name}</Link>
                      </TextLink>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Исполнитель</dt>
                  <dd>{data.assignee?.full_name}</dd>
                </div>
                <div>
                  <dt>Постановщик</dt>
                  <dd>{data.author?.full_name}</dd>
                </div>
                <div>
                  <dt>Создана</dt>
                  <dd>{formatDate(data.created_at)}</dd>
                </div>
              </dl>
              <ContentSection>
                <SectionHeader title="Описание" />
                <p className="task-description">{data.description || 'Описание не добавлено.'}</p>
              </ContentSection>
            </CardContent>
          </Card>
          {actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {profile.role === 'manager' ? 'Решение по задаче' : 'Работа над задачей'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="form-stack">
                  <FormField
                    id="transition-comment"
                    label="Комментарий"
                    hint={
                      profile.role === 'manager'
                        ? 'При возврате на доработку комментарий обязателен.'
                        : 'Можно добавить пояснение к изменению статуса.'
                    }
                  >
                    {(attrs) => (
                      <Textarea
                        {...attrs}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        maxLength={2000}
                        disabled={change.isPending}
                        rows={3}
                      />
                    )}
                  </FormField>
                  {change.error && (
                    <Notice tone="danger" role="alert">
                      {message(change.error)}
                    </Notice>
                  )}
                  <ActionGroup>
                    {actions.map((action) => (
                      <Button
                        key={action.status}
                        variant={action.status === 'rework' ? 'outline' : 'default'}
                        disabled={
                          change.isPending || (action.status === 'rework' && !comment.trim())
                        }
                        onClick={() => change.mutate(action.status)}
                      >
                        {change.isPending ? 'Сохраняем…' : action.label}
                      </Button>
                    ))}
                  </ActionGroup>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>История задачи</CardTitle>
            <CardDescription>Кто и когда менял статус</CardDescription>
          </CardHeader>
          <CardContent>
            {history.isPending ? (
              <LoadingState scope="local" />
            ) : history.isError ? (
              <ErrorState
                scope="local"
                message="Не удалось загрузить историю"
                onRetry={() => void history.refetch()}
              />
            ) : (
              <>
                <ol className="history-list">
                  {history.data.rows.map((entry) => (
                    <li key={entry.id}>
                      <ContentSection>
                        <div className="history-heading">
                          <strong>{entry.actor?.full_name}</strong>
                          <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                        </div>
                        <p>
                          {entry.from_status
                            ? `${statusLabels[entry.from_status]} → ${statusLabels[entry.to_status]}`
                            : 'Задача создана · Новая'}
                        </p>
                        {entry.comment && <p className="task-description">{entry.comment}</p>}
                      </ContentSection>
                    </li>
                  ))}
                </ol>
                <Pagination
                  page={historyPage}
                  count={history.data.count}
                  onPage={setHistoryPage}
                  pending={history.isFetching}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {editing && site.data && (
        <TaskForm task={data} site={site.data} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
