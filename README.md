# MapMe

MapMe is a concise, self-hosted map for places you visited, want to visit, or simply want to remember. It combines a searchable place list with Leaflet, configurable OpenStreetMap-compatible raster tiles, categories, tags, photos, portable exports, and complete backups.

MapMe is intentionally single-user. It does not include registration, collaboration, itineraries, route planning, GPS tracking, social features, or a separate API service.

## Quick start

```sh
docker run -d \
  --name mapme \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/mapme-data:/data \
  -e ORIGIN=http://localhost:3000 \
  ghcr.io/tylxr59/mapme:latest
```

Open `http://localhost:3000`. All persistent data is under `/data`:

```text
/data/
├── database.sqlite
├── database.sqlite-wal
├── database.sqlite-shm
├── uploads/
└── backups/
```

Only run one MapMe container against a data directory.

## Password authentication

Generate an Argon2id hash interactively:

```sh
docker run --rm -it ghcr.io/tylxr59/mapme:latest hash-password
```

Set:

```text
AUTH_MODE=password
AUTH_PASSWORD_HASH=$argon2id$...
ORIGIN=https://places.example.com
```

The plaintext password is never stored. Changing the hash invalidates existing sessions.

## Reverse-proxy authentication

Set `AUTH_MODE=proxy`, `AUTH_PROXY_HEADER`, and a comma-separated `AUTH_PROXY_TRUSTED_CIDRS`. MapMe accepts the identity header only when the immediate connection is from one of those networks. Keep port 3000 unreachable except through the authenticating proxy.

## Geocoding and tiles

Public Nominatim search is enabled by default and only runs when a user explicitly presses Search. It is cached and globally limited to one request per second. Do not turn on `GEOCODING_AUTOCOMPLETE` for the public endpoint; its usage policy forbids autocomplete. Map clicks, direct coordinates, and manual addresses work when geocoding is disabled.

The default raster tiles come from OpenStreetMap and display the required attribution. Change `TILE_URL`, `TILE_ATTRIBUTION`, and `TILE_MAX_ZOOM` together when using another provider.

## Import, export, and backup

- GeoJSON is the canonical interchange format.
- CSV uses a fixed header and stores tags as a JSON array.
- KML imports point placemarks only; folders become tags and embedded HTML is converted to text.
- Imports are previewed and likely duplicates are skipped unless explicitly imported as copies.
- Complete ZIP backups contain a consistent SQLite snapshot, uploads, checksums, and a manifest.
- Web restores are inspected, staged, and activated after one deliberate restart.

If the active database is too damaged to start the UI, stop the normal container and run:

```sh
docker run --rm -it \
  -v /path/to/mapme-data:/data \
  ghcr.io/tylxr59/mapme:latest \
  restore-backup /data/backups/mapme-backup-....zip
```

The previous database and uploads are retained under `/data/backups/rollback-*`.

## Unraid

Use `unraid/mapme.xml`, or configure:

- Repository: `ghcr.io/tylxr59/mapme:latest`
- Network: Bridge
- Port: `3000 -> 3000`
- Path: `/mnt/user/appdata/mapme -> /data`
- `PUID=99`, `PGID=100`
- Set `ORIGIN` to the exact URL used to access MapMe

Docker Compose is not required.

## Development

Requires Node.js 24.

```sh
cp .env.example .env
npm install
npm run dev
```

Quality checks:

```sh
npm run format:check
npm run lint
npm run check
npm test
npm run build
npm run test:e2e
```

Database access is isolated under `src/lib/server/db`, migrations are immutable numbered SQL files under `migrations`, and all server inputs are validated with Zod.

## Releases

Tags such as `v1.2.3` build `linux/amd64` and `linux/arm64` images and publish `1.2.3`, `1.2`, `1`, and `latest` to GHCR. Prerelease tags publish only their exact prerelease version.

## License

MIT
