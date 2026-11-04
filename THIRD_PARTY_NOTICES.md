# Сторонние компоненты

- `vendor/pdlc-ui-0.3.33.tgz`: Base PDLC, FerrPOINT. Точный commit записан в
  `.base-ui-revision`; LICENSE и NOTICE сохранены внутри пакета.
- `deploy/roles.sql`: адаптация `docker/volumes/db/roles.sql` из
  [Supabase](https://github.com/supabase/supabase/tree/82671cbb65257a001ec5530d781aa86d54d38345/docker),
  Apache License 2.0. Сохранены только настройки паролей используемых сервисных ролей.
- Шрифты Base поставляются со своими лицензиями. Build plugin копирует их
  в `dist/licenses/pdlc-ui-fonts/`.
- React, Supabase JS, TanStack Query, Vite и остальные зависимости сохраняют
  собственные лицензии в пакетах; точные версии закреплены `pnpm-lock.yaml`.
