# Сторонние компоненты

- `src/ui/`: компоненты Base PDLC, FerrPOINT, перенесённые по поручению владельца.
  Исходная версия и адаптации описаны в `src/ui/README.md`; LICENSE и NOTICE
  сохранены рядом с кодом. Локальные изменения принадлежат mini-crm.
- `deploy/roles.sql`: адаптация `docker/volumes/db/roles.sql` из
  [Supabase](https://github.com/supabase/supabase/tree/82671cbb65257a001ec5530d781aa86d54d38345/docker),
  Apache License 2.0. Сохранены только настройки паролей используемых сервисных ролей.
- Шрифты Base поставляются со своими лицензиями в `public/licenses/fonts/`;
  Vite включает этот каталог в `dist/licenses/fonts/`.
- React, Supabase JS, TanStack Query, Vite и остальные зависимости сохраняют
  собственные лицензии в пакетах; точные версии закреплены `pnpm-lock.yaml`.
