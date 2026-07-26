# MapMe

MapMe is a concise, self-hosted map for places you visited, want to visit, or simply want to remember. It combines a searchable place list with Leaflet, configurable OpenStreetMap-compatible raster tiles, customizable categories, photos, portable exports, and complete backups.

MapMe is intentionally single-user. It does not include registration, collaboration, itineraries, route planning, GPS tracking, social features, or a separate API service.

## Quick start

```sh
docker run -d \
  --name mapme \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/mapme-data:/data \
  ghcr.io/tylxr59/mapme:latest
```

Open `http://localhost:3000` and complete the first-run page. MapMe detects the address you used,
offers password, trusted-proxy, or private-network access, and stores the result in `/data`.
Complete setup before exposing a new instance to an untrusted network.

All persistent data is under `/data`:

```text
/data/
├── database.sqlite
├── database.sqlite-wal
├── database.sqlite-shm
├── uploads/
├── tile-cache/
└── backups/
```

Only run one MapMe container against a data directory.

## Access settings

The first-run page recommends password protection and hashes the password with Argon2id before it
is stored. The plaintext password is never stored. Change the public address, access mode, or
password later under **Settings → General**; changing access credentials invalidates old sessions.

## Reverse-proxy authentication

Choose **Reverse proxy** during first-run setup or under **Settings → General**, then enter the
identity header and comma-separated trusted proxy CIDRs. MapMe accepts the identity header only
when the immediate connection is from one of those networks. Keep port 3000 unreachable except
through the authenticating proxy.

## Geocoding and tiles

Public Nominatim search is enabled by default and only runs when a user explicitly presses Search. It is cached and globally limited to one request per second. Do not turn on `GEOCODING_AUTOCOMPLETE` for the public endpoint; its usage policy forbids autocomplete. Map clicks, direct coordinates, and manual addresses work when geocoding is disabled.

The default raster tiles come from OpenStreetMap and display the required attribution. MapMe
proxies user-requested tiles through the same origin and keeps a persistent, HTTP-aware cache
under `/data/tile-cache`. This avoids relaxing cross-origin referrer protections in privacy-focused
browsers. The proxy sends an identifiable MapMe user agent and an origin-only referrer, honors
upstream cache headers, conditionally revalidates expired tiles, and never prefetches map areas.

Set `TILE_PROXY_ENABLED=false` to request tiles directly from the browser. Change `TILE_URL`,
`TILE_ATTRIBUTION`, and `TILE_MAX_ZOOM` together when using another provider.
`TILE_CACHE_MAX_MB` limits the on-disk cache and defaults to 512 MiB. Cached tiles are disposable
and are intentionally excluded from MapMe backups.

## Import, export, and backup

- GeoJSON is the canonical interchange format.
- CSV uses a fixed, human-readable header.
- KML imports point placemarks only and converts embedded HTML to text.
- GPX imports waypoints only and is tailored for OsmAnd Favorites exports; imported waypoints are
  marked as favorites.
- Imports are previewed and likely duplicates are skipped unless explicitly imported as copies.
- Complete ZIP backups contain a consistent SQLite snapshot, uploads, checksums, and a manifest.
- Web restores are inspected, staged, and activated after one deliberate restart.

## Category icons

Categories can use any icon bundled with [Lucide](https://lucide.dev/icons/). The category editor
includes a fuzzy, place-oriented search—terms such as “shooting range,” “overlanding,” and “urbex”
find relevant options—or you can paste any Lucide icon ID directly.

If the active database is too damaged to start the UI, stop the normal container and run:

```sh
docker run --rm -it \
  -v /path/to/mapme-data:/data \
  ghcr.io/tylxr59/mapme:latest \
  restore-backup /data/backups/mapme-backup-....zip
```

The previous database and uploads are retained under `/data/backups/rollback-*`.

## Unraid

### Install with the template

Open the Unraid terminal and install the included Docker template:

```sh
mkdir -p /boot/config/plugins/dockerMan/templates-user
curl -fsSL \
  https://raw.githubusercontent.com/tylxr59/MapMe/main/unraid/mapme.xml \
  -o /boot/config/plugins/dockerMan/templates-user/my-mapme.xml
```

Then open **Docker → Add Container** and select **MapMe** from the Template dropdown.

### Configure manually

Open **Docker → Add Container** and configure these container fields:

| Field        | Value                                |
| ------------ | ------------------------------------ |
| Name         | `MapMe`                              |
| Repository   | `ghcr.io/tylxr59/mapme:latest`       |
| Network Type | Your normal Docker network           |
| Port mapping | Host `3000` → Container `3000`       |
| Path mapping | `/mnt/user/appdata/mapme/` → `/data` |

Click **Apply**, open the Web UI, and complete first-run setup. No container variables are
required. The included Unraid template exposes only the port and application-data path.

Docker Compose is not required.

### Optional environment overrides

MapMe's defaults are ready for normal use. Advanced operators can still set the documented values
in [`.env.example`](.env.example) for custom tile, geocoding, storage, and upload behavior.
`ORIGIN`, `AUTH_MODE`, `AUTH_PASSWORD_HASH`, `AUTH_PROXY_HEADER`, and
`AUTH_PROXY_TRUSTED_CIDRS` are supported as one-time bootstrap values for automated or v1.0
deployments. Once saved, access settings are managed in the application.

## Nginx Proxy Manager

MapMe works behind a standard Nginx Proxy Manager Proxy Host:

1. Set the domain name, forward scheme `http`, MapMe's reachable host or container name, and
   forward port `3000`.
2. On the SSL tab, request or select a certificate and enable **Force SSL**.
3. Open MapMe through its final `https://` domain for the first visit. The setup page reads NPM's
   forwarded host and protocol headers and should show that HTTPS address.
4. Keep MapMe's direct port private if the domain is meant to be its only entry point.

MapMe does not require WebSocket support. For complete backup restores through NPM, add this under
the Proxy Host's **Advanced** tab so Nginx accepts and streams MapMe's configured maximum upload:

```nginx
client_max_body_size 2100m;
proxy_request_buffering off;
```

NPM's normal Proxy Host mode is separate from MapMe's **Reverse proxy** access mode. Use MapMe's
password option for the simplest setup. Only choose its reverse-proxy access mode when your
authentication proxy deliberately supplies the configured identity header.

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
