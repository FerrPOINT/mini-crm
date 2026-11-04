# Мини-CRM «Объекты и задачи»

React + TypeScript, Supabase Auth и PostgreSQL/PostgREST. Интерфейс использует
локальные компоненты, перенесённые из Base PDLC. Постановщики управляют стройками и задачами,
исполнители работают только с назначенными им задачами.

## Быстрый запуск с готовым Supabase

Требуются Node.js 22.22+ и pnpm 10.28.1.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

В `.env.local` укажите `VITE_SUPABASE_URL` и публичный
`VITE_SUPABASE_ANON_KEY`. Примените SQL из `supabase/migrations/` по порядку
через SQL Editor или Supabase CLI. В настройках Auth отключите регистрацию.

Создайте подтверждённых пользователей в Auth, затем добавьте соответствующие
строки `profiles` с теми же UUID, именем и ролью `manager` или `executor`.
Роль хранится в защищённой таблице: пользователь не может назначить её себе.

```sh
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

## Собственный сервер: Docker Compose

Развёрнутый вариант использует Supabase PostgreSQL, Auth и PostgREST.
Nginx отдаёт приложение и проксирует `/api` на том же origin.
База не публикуется наружу; административный Auth API слушает только loopback.
Studio, Storage и Realtime этому заданию не нужны.

На **новой установке**, из корня клонированного репозитория:

```sh
python3 scripts/init-environment.py
pnpm install --frozen-lockfile
pnpm build
docker compose --env-file .env.local -f deploy/compose.yml up -d db auth rest
for migration in supabase/migrations/*.sql; do
  docker compose --env-file .env.local -f deploy/compose.yml exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$migration" || exit 1
done
docker compose --env-file .env.local -f deploy/compose.yml up -d web
pnpm seed
pnpm test:api
```

Приложение доступно на `http://127.0.0.1:8788`. Для доступа с другого компьютера
используйте SSH forwarding либо собственный HTTPS reverse proxy. Не передавайте
пароли через публичный HTTP. Не применяйте начальную миграцию повторно к
существующей базе; добавляйте только новые миграции. Не удаляйте volumes при обновлении.

Секреты и тестовые пароли создаются один раз в `.env.local` с правами `0600`.
`SUPABASE_SERVICE_ROLE_KEY` нужен только серверным seed/test-скриптам и не
попадает в Vite bundle. Публичный anon key безопасен только вместе с RLS.

Необязательный профиль `public` запускает Cloudflare Quick Tunnel:

```sh
docker compose --env-file .env.local -f deploy/compose.yml --profile public up -d tunnel
docker compose --env-file .env.local -f deploy/compose.yml logs tunnel
```

Это временный адрес для демонстрации: после пересоздания туннеля он меняется.
Для постоянного адреса используйте свой домен и именованный туннель/reverse proxy.

## Проверка безопасности

`pnpm test:api` обращается к настоящему API тремя пользователями и анонимно.
Проверяются изоляция данных, закрытая регистрация, запрет самостоятельной смены
роли, все разрешённые и запрещённые переходы, неизменяемость автора/даты/истории,
повторный конкурентный переход, переназначение и удаление. Fixtures удаляются
административным клиентом в конце прогона; демонстрационные записи сохраняются.
Запускайте этот набор только на выделенном тестовом окружении.

Смена статуса и запись истории выполняются одной транзакцией с блокировкой
задачи. Клиенты не имеют права непосредственно обновлять `status` и писать
в `task_history`. Устаревшая карточка получает HTTP 409, а не автоматический
повтор операции. Для создания задачи база сама задаёт автора, время и статус.

## Состав проекта

- `src/` — экраны, типизированные запросы и правила видимости кнопок.
- `supabase/migrations/` — схема, grants, RLS, проверка переходов и история.
- `tests/security.test.mjs` — проверки прямых запросов к API.
- `deploy/` — изолированный Compose и Nginx.
- [Объяснение для руководителя](docs/explanation.md).
- [Решения и допущения](docs/decisions.md).
- [Полный пользовательский workflow и автотесты](docs/workflow.md).

## Браузерные автотесты

На отдельном тестовом стенде с демонстрационными пользователями:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Набор проверяет сквозной цикл задачи и удобство интерфейса в Chromium
на desktop и mobile. По умолчанию используется `http://127.0.0.1:8788`;
адрес другого тестового стенда задаётся через `E2E_BASE_URL`. Ключи и пароли
читаются из приватного `.env.local`. Каждый тест очищает только свои fixtures.
Отчёт и снимки падений сохраняются в игнорируемых Git каталогах;
не публикуйте их без проверки на учётные данные.
Сценарии, покрытие и ограничения перечислены в [workflow](docs/workflow.md).

## Локальный интерфейс

Используемые компоненты, стили, шрифты и механизмы интерфейса находятся в
`src/ui/`. Они перенесены из Base PDLC и развиваются в этом репозитории.
Сведения о происхождении и адаптациях — в [описании UI](src/ui/README.md).
Обычные зависимости Radix, React и утилиты оформления объявлены в `package.json`.
Сборка использует локальные исходники; подготовка UI-пакета не требуется.

LICENSE/NOTICE исходных компонентов сохранены в `src/ui/`; условия отличаются
от лицензий сторонних open-source зависимостей. Лицензии шрифтов поставляются
в `dist/licenses/fonts/` из `public/licenses/fonts/`.
Начальная схема уже применялась на тестовом сервере, поэтому исправление
контракта конфликта оформлено отдельной второй миграцией.

Официальные материалы:
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[безопасность функций](https://supabase.com/docs/guides/database/functions),
[самостоятельная установка Supabase](https://supabase.com/docs/guides/self-hosting/docker).
