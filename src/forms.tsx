import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FormField, Input, Textarea, SearchableSelect } from './ui';
import { api } from './api';
import type { Site, Task } from './domain';
import { FormModal, SaveActions } from './components';

export function SiteForm({ site, onClose }: { site?: Site; onClose: () => void }) {
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const save = useMutation({
    mutationFn: (values: Pick<Site, 'name' | 'address'>) => api.saveSite(values, site?.id),
    onSuccess: onClose,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.reset();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get('name')).trim(),
      address: String(data.get('address')).trim(),
    };
    const errors = {
      name: values.name ? undefined : 'Укажите название объекта.',
      address: values.address ? undefined : 'Укажите адрес объекта.',
    };
    setErrors(errors);
    if (errors.name || errors.address) {
      const field = event.currentTarget.elements.namedItem(errors.name ? 'name' : 'address');
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    save.mutate(values);
  }
  return (
    <FormModal
      title={site ? 'Редактировать объект' : 'Новый объект'}
      description="Название и адрес стройки"
      pending={save.isPending}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <FormField id="site-name" label="Название" required error={errors.name}>
          {(attrs) => (
            <Input
              {...attrs}
              name="name"
              defaultValue={site?.name}
              onChange={() => setErrors((current) => ({ ...current, name: undefined }))}
              maxLength={200}
              disabled={save.isPending}
              autoFocus
            />
          )}
        </FormField>
        <FormField id="site-address" label="Адрес" required error={errors.address}>
          {(attrs) => (
            <Textarea
              {...attrs}
              name="address"
              defaultValue={site?.address}
              onChange={() => setErrors((current) => ({ ...current, address: undefined }))}
              maxLength={500}
              disabled={save.isPending}
              rows={2}
            />
          )}
        </FormField>
        <SaveActions pending={save.isPending} error={save.error} onClose={onClose} />
      </form>
    </FormModal>
  );
}

export function TaskForm({
  task,
  site,
  onClose,
}: {
  task?: Task;
  site: Site;
  onClose: () => void;
}) {
  const [titleError, setTitleError] = useState<string>();
  const [siteId, setSiteId] = useState(task?.site_id ?? site.id);
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '');
  const [siteSearch, setSiteSearch] = useState('');
  const [sitePage, setSitePage] = useState(0);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peoplePage, setPeoplePage] = useState(0);
  const sites = useQuery({
    queryKey: ['site-options', sitePage, siteSearch],
    queryFn: ({ signal }) => api.sites(sitePage, signal, siteSearch),
  });
  const people = useQuery({
    queryKey: ['executor-options', peoplePage, peopleSearch],
    queryFn: ({ signal }) => api.executors(peoplePage, peopleSearch, signal),
  });
  const selectedSite = useQuery({
    queryKey: ['site', siteId],
    queryFn: ({ signal }) => api.site(siteId, signal),
    enabled: Boolean(siteId),
    initialData: siteId === site.id ? site : undefined,
  });
  const selectedPerson = useQuery({
    queryKey: ['profile', assigneeId],
    queryFn: ({ signal }) => api.profile(assigneeId, signal),
    enabled: Boolean(assigneeId),
  });
  const save = useMutation({
    mutationFn: (values: Pick<Task, 'title' | 'description' | 'site_id' | 'assignee_id'>) =>
      api.saveTask(values, task?.id),
    onSuccess: onClose,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.reset();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title')).trim();
    if (!title) {
      setTitleError('Укажите название задачи.');
      const field = event.currentTarget.elements.namedItem('title');
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    save.mutate({
      title,
      description: String(data.get('description')).trim(),
      site_id: siteId,
      assignee_id: assigneeId,
    });
  }
  return (
    <FormModal
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      description="Укажите работу, объект и исполнителя"
      pending={save.isPending}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <FormField id="task-title" label="Название" required error={titleError}>
          {(attrs) => (
            <Input
              {...attrs}
              name="title"
              defaultValue={task?.title}
              onChange={() => setTitleError(undefined)}
              maxLength={200}
              disabled={save.isPending}
              autoFocus
            />
          )}
        </FormField>
        <FormField id="task-description" label="Описание">
          {(attrs) => (
            <Textarea
              {...attrs}
              name="description"
              defaultValue={task?.description}
              maxLength={10000}
              rows={4}
              disabled={save.isPending}
            />
          )}
        </FormField>
        <SearchableSelect
          id="task-site"
          label="Объект"
          placeholder="Выберите объект"
          allowEmpty={false}
          value={siteId}
          selectedLabel={selectedSite.data?.name}
          onChange={setSiteId}
          options={sites.data?.rows.map((row) => ({ value: row.id, label: row.name })) ?? []}
          search={siteSearch}
          onSearch={(value) => {
            setSiteSearch(value);
            setSitePage(0);
          }}
          offset={sitePage * 20}
          pageSize={20}
          total={sites.data?.count}
          onPage={(offset) => setSitePage(offset / 20)}
          loading={sites.isPending}
          error={sites.isError ? 'Не удалось загрузить объекты' : undefined}
          onRetry={() => void sites.refetch()}
          disabled={save.isPending}
        />
        <SearchableSelect
          id="task-assignee"
          label="Исполнитель"
          placeholder="Выберите исполнителя"
          allowEmpty={false}
          value={assigneeId}
          selectedLabel={
            selectedPerson.data?.full_name ??
            (assigneeId === task?.assignee_id ? task?.assignee?.full_name : undefined)
          }
          onChange={setAssigneeId}
          options={people.data?.rows.map((row) => ({ value: row.id, label: row.full_name })) ?? []}
          search={peopleSearch}
          onSearch={(value) => {
            setPeopleSearch(value);
            setPeoplePage(0);
          }}
          offset={peoplePage * 20}
          pageSize={20}
          total={people.data?.count}
          onPage={(offset) => setPeoplePage(offset / 20)}
          loading={people.isPending}
          error={people.isError ? 'Не удалось загрузить исполнителей' : undefined}
          onRetry={() => void people.refetch()}
          disabled={save.isPending}
        />
        <SaveActions
          pending={save.isPending}
          error={save.error}
          onClose={onClose}
          disabled={!siteId || !assigneeId}
        />
      </form>
    </FormModal>
  );
}
