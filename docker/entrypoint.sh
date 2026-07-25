#!/bin/sh
set -eu

MAPME_PUID="${PUID:-10001}"
MAPME_PGID="${PGID:-10001}"

if [ "$(id -u)" = "0" ]; then
  if ! getent group mapme >/dev/null 2>&1; then
    groupadd --gid "$MAPME_PGID" mapme
  elif [ "$(getent group mapme | cut -d: -f3)" != "$MAPME_PGID" ]; then
    groupmod --gid "$MAPME_PGID" mapme
  fi
  if ! id mapme >/dev/null 2>&1; then
    useradd --uid "$MAPME_PUID" --gid mapme --home-dir /nonexistent --shell /usr/sbin/nologin mapme
  elif [ "$(id -u mapme)" != "$MAPME_PUID" ]; then
    usermod --uid "$MAPME_PUID" mapme
  fi

  mkdir -p "${DATABASE_PATH%/*}" "${UPLOAD_PATH:-/data/uploads}" "${BACKUP_PATH:-/data/backups}"
  chown -R "$MAPME_PUID:$MAPME_PGID" /data
  chmod 700 /data "${UPLOAD_PATH:-/data/uploads}" "${BACKUP_PATH:-/data/backups}"

  case "${1:-}" in
    hash-password|restore-backup)
      exec gosu "$MAPME_PUID:$MAPME_PGID" node scripts/startup.mjs "$@"
      ;;
    *)
      exec gosu "$MAPME_PUID:$MAPME_PGID" "$@"
      ;;
  esac
fi

exec "$@"
