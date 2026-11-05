# Публикация по домену

Адрес: **https://demo.azhukov-dev.ru**.

```text
Клиент → Koara:443 (TLS) → Nginx → SSH 127.0.0.1:18788
        → Firebat1 127.0.0.1:8788 → Nginx → Auth / PostgREST
```

DNS A указывает на Koara `23.26.37.158`. CRM и база остаются на Firebat1
в `/opt/dev/projects/mini-crm`; публичный шлюз не хранит данные CRM.

## Конфигурация

| Исходник                                                           | Установленный путь                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [gateway-nginx.conf](../deploy/gateway-nginx.conf)                 | Koara `/etc/nginx/conf.d/mini-crm.conf`                          |
| [gateway-sshd.conf](../deploy/gateway-sshd.conf)                   | Koara `/etc/ssh/sshd_config.d/61-mini-crm.conf`                  |
| [gateway-xray.json](../deploy/gateway-xray.json)                   | Добавляемые certificate/fallback в действующем TLS inbound Koara |
| [certificate-deploy-hook.sh](../deploy/certificate-deploy-hook.sh) | Koara `/etc/letsencrypt/renewal-hooks/deploy/mini-crm-xray`      |
| [mini-crm-tunnel.service](../deploy/mini-crm-tunnel.service)       | Firebat1 `/etc/systemd/system/mini-crm-tunnel.service`           |
| [nginx.conf.template](../deploy/nginx.conf.template)               | Origin Nginx, штатная подстановка окружения Docker image         |

Порт 443 на Koara уже обслуживается Xray. Для имени `demo.azhukov-dev.ru`
добавлены отдельный сертификат и штатный SNI-маршрут с PROXY protocol v1.
Остальные TLS-имена и настройки VPN сохраняются. Полный конфиг Xray содержит
секреты и остаётся только на шлюзе; JSON в репозитории — добавляемый фрагмент.
Его `certificate` входит в `streamSettings.tlsSettings.certificates`,
а `fallback` — в `settings.fallbacks` существующего inbound на порту 443.

## Туннель и доверие к адресу

На Firebat1 служба работает от `ferrpoint`. Ключ
`/home/ferrpoint/.ssh/mini_crm_koara_ed25519` не покидает хост. Отдельный
known_hosts содержит проверенный публичный ключ Koara; проверка ключа обязательна.
Учётная запись `mini-crm-tunnel` на шлюзе допускает только remote forwarding
на `127.0.0.1:18788`, без shell, PTY, пароля и локального forwarding.
Systemd восстанавливает оборвавшееся SSH-соединение.

Шлюз получает адрес клиента из PROXY protocol и заменяет входящие
`X-Real-IP`/`X-Forwarded-For`. Origin принимает `X-Real-IP` только от адреса
Docker gateway своей сети. В `.env.local` Firebat1 заданы:

```dotenv
PUBLIC_URL=https://demo.azhukov-dev.ru
TRUSTED_PROXY_CIDR=172.18.0.1/32
```

Это адрес текущей установки, не универсальный адрес Docker. После создания
сети на другом хосте определите gateway через `docker network inspect
mini-crm_default` и укажите точный `/32`. Без настройки доверяется только
loopback; локальная установка не принимает клиентский IP от внешних peers.

После изменения этих значений пересоздайте только Auth и web:

```sh
docker compose --env-file .env.local -f deploy/compose.yml up -d --no-deps --wait auth web
```

## Сертификат

Certbot использует существующий webroot шлюза и HTTP-01:

```sh
certbot certonly --webroot -w /var/www/letsencrypt \
  -d demo.azhukov-dev.ru --cert-name demo.azhukov-dev.ru
```

Продление выполняет `certbot.timer`. Deploy hook устанавливает сертификат
и ключ в `/etc/xray/tls/mini-crm`, root:xray, файлы `0640`. Xray перечитывает
файлы сертификата каждый час при `oneTimeLoading: false`; продление не
перезапускает общий TLS listener. Изменение SNI-маршрутов требует проверки
`xray run -test -config /etc/xray/config.json` и применения конфигурации шлюза.

## Проверка и откат

Проверки: `nginx -t`, `sshd -t`, состояние `mini-crm-tunnel`, HTTPS с обычной
проверкой сертификата, совпадение публичных HTML/JS/CSS с `dist`,
`pnpm test:proxy` и E2E `AUTH`/`FLOW` по домену на desktop/mobile.

При изменении приложения этот маршрут сохраняется; сборка публикуется на
Firebat1. При отказе туннеля восстанавливайте его службу и ключ, проверяя
loopback listener на Koara. Откат конфигурации выполняется совместимым Git-коммитом;
база и volumes не сбрасываются. Временный Cloudflare Tunnel удалён.

Механизмы: [Xray TLS](https://xtls.github.io/en/config/transports/tls.html),
[SNI routing](https://xtls.github.io/en/config/features/fallback.html),
[Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).
