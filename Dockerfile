# syntax=docker/dockerfile:1.7
FROM node:26.6.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=optional

FROM dependencies AS build
COPY . .
RUN npm run check && npm run build
RUN npm prune --omit=dev

FROM node:26.6.0-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/tylxr59/MapMe" \
      org.opencontainers.image.description="A concise self-hosted map for saving interesting places" \
      org.opencontainers.image.licenses="MIT"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 mapme \
    && useradd --uid 10001 --gid mapme --home-dir /nonexistent --shell /usr/sbin/nologin mapme
WORKDIR /app
COPY --from=build --chown=mapme:mapme /app/build ./build
COPY --from=build --chown=mapme:mapme /app/node_modules ./node_modules
COPY --from=build --chown=mapme:mapme /app/package.json ./
COPY --from=build --chown=mapme:mapme /app/migrations ./migrations
COPY --from=build --chown=mapme:mapme /app/scripts ./scripts
COPY --chown=root:root docker/entrypoint.sh /usr/local/bin/mapme-entrypoint
COPY --chown=mapme:mapme docker/healthcheck.mjs ./docker/healthcheck.mjs
RUN chmod 755 /usr/local/bin/mapme-entrypoint

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/database.sqlite \
    UPLOAD_PATH=/data/uploads \
    BACKUP_PATH=/data/backups \
    TILE_CACHE_PATH=/data/tile-cache \
    TILE_PROXY_ENABLED=true \
    TILE_CACHE_MAX_MB=512 \
    BODY_SIZE_LIMIT=2100M \
    SHUTDOWN_TIMEOUT=30 \
    PUID=10001 \
    PGID=10001

VOLUME ["/data"]
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "docker/healthcheck.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/mapme-entrypoint"]
CMD ["node", "scripts/startup.mjs"]
