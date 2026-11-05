#!/bin/sh
set -eu
[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/demo.azhukov-dev.ru ] || exit 0
# Xray reloads file certificates hourly; renewal does not restart the shared listener.
install -d -m 0750 -o root -g xray /etc/xray/tls/mini-crm
install -m 0640 -o root -g xray "$RENEWED_LINEAGE/fullchain.pem" /etc/xray/tls/mini-crm/fullchain.pem
install -m 0640 -o root -g xray "$RENEWED_LINEAGE/privkey.pem" /etc/xray/tls/mini-crm/privkey.pem
