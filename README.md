<p align="center">
  <img src="static/icons/app-192.png" alt="MapMe logo" width="112" height="112">
</p>

<h1 align="center">MapMe</h1>

<p align="center">
  A private, self-hosted map for the places you want to remember.
</p>

<p align="center">
  <a href="https://github.com/tylxr59/MapMe/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/tylxr59/MapMe/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/tylxr59/MapMe/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/tylxr59/MapMe?display_name=tag&sort=semver"></a>
  <a href="https://github.com/tylxr59/MapMe/pkgs/container/mapme"><img alt="Container image" src="https://img.shields.io/badge/GHCR-linux%2Famd64%20%7C%20linux%2Farm64-26734c?logo=docker&logoColor=white"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/tylxr59/MapMe"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-unraid">Unraid</a> ·
  <a href="#-reverse-proxy">Reverse proxy</a> ·
  <a href="#-data-and-backups">Data and backups</a>
</p>

---

## 🗺️ MapMe

MapMe is a focused place-bookmarking app with a map at its center. Save a restaurant, trailhead,
shooting range, urbex site, scenic pull-off, or anywhere else worth finding again. Add context,
photos, ratings, and a category, then let MapMe keep the collection searchable and portable.

It is designed for one person or household to run on infrastructure they control. There are no
accounts to register, advertisements, analytics, or external application database to maintain.
One container and one persistent directory are enough.

> [!NOTE]
> MapMe is intentionally not an itinerary planner, route tracker, navigation app, or social
> network. It does one job: privately organize places you care about.

## 🎯 Features

|                           |                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| 🗺️ **Map-first library**  | Browse clustered markers alongside a searchable, filterable place list.                             |
| 📍 **Rich place details** | Store coordinates, address, status, rating, visit date, notes, source link, and photos.             |
| ⭐ **Useful ordering**    | Favorites lead the list, followed by rating and then name.                                          |
| 🎨 **Custom categories**  | Choose colors and any bundled Lucide icon with fuzzy, place-oriented icon search.                   |
| 🔎 **Optional geocoding** | Search addresses and points of interest through Nominatim, with respectful caching and rate limits. |
| 🧭 **Private map tiles**  | Proxy and cache OpenStreetMap-compatible tiles through MapMe's own origin.                          |
| 📦 **Portable data**      | Preview imports from GeoJSON, CSV, KML, and GPX; export GeoJSON or CSV at any time.                 |
| 💾 **Complete backups**   | Create and restore verified ZIP backups containing SQLite data, uploads, and a manifest.            |
| 🔐 **Flexible access**    | Use one shared password, a trusted authentication proxy, or no sign-in on a private network.        |
| 📱 **Installable PWA**    | Add MapMe to a desktop or mobile home screen, with automatic light and dark themes.                 |

## 🚀 Quick start

MapMe requires Docker and a directory for persistent application data.

```sh
docker run -d \
  --name mapme \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/mapme-data:/data \
  ghcr.io/tylxr59/mapme:latest
```

Open `http://localhost:3000` and complete the first-run setup. MapMe detects the address you used
and lets you choose password, trusted-proxy, or private-network access from the browser. No
environment variables are required for a normal installation.

> [!IMPORTANT]
> Finish first-run setup before exposing a new instance to an untrusted network, and never run
> multiple MapMe containers against the same `/data` directory.

### Persistent data

Everything needed to move or restore an instance lives under `/data`:

```text
/data/
├── database.sqlite
├── database.sqlite-wal
├── database.sqlite-shm
├── uploads/
├── tile-cache/
└── backups/
```

The tile cache is disposable and intentionally excluded from MapMe backups.

## 🖥️ Unraid

Only the image, port, and data path are required:

| Unraid field | Value                                |
| ------------ | ------------------------------------ |
| Name         | `MapMe`                              |
| Repository   | `ghcr.io/tylxr59/mapme:latest`       |
| Network Type | Your normal Docker network           |
| Port         | Host `3000` → Container `3000`       |
| Data         | `/mnt/user/appdata/mapme/` → `/data` |

Open the Web UI and complete setup. Docker Compose and container variables are not required.

## 🌐 Reverse proxy

MapMe works behind a standard reverse proxy and respects forwarded host and protocol headers
during first-run setup.

### Nginx Proxy Manager

1. Create a **Proxy Host** for your domain.
2. Forward it over `http` to the MapMe host or container on port `3000`.
3. Add or request a certificate under **SSL** and enable **Force SSL**.
4. Visit MapMe through its final `https://` address and complete first-run setup there.
5. Keep port `3000` private if the proxy should be the only entry point.

WebSocket support is not required. To allow large backup restores, add this under the Proxy Host's
**Advanced** tab:

```nginx
client_max_body_size 2100m;
proxy_request_buffering off;
```

Nginx Proxy Manager's normal proxying is separate from MapMe's **Reverse proxy** access mode. Use
MapMe's password option for the simplest setup. Choose **Reverse proxy** access only when an
authentication proxy deliberately supplies the configured identity header.

### Trusted proxy authentication

When this access mode is enabled, MapMe accepts the identity header only if the immediate
connection comes from one of the configured CIDR networks. Keep the direct application port
unreachable except through the authenticating proxy.

## 🔐 Access and privacy

The first-run page recommends password protection. Passwords are hashed with Argon2id before
storage, and plaintext passwords are never retained. Changing access credentials under
**Settings → General** invalidates existing sessions.

MapMe does not include telemetry or analytics. Network requests made by a default installation are
limited to resources needed for the map and user-requested geocoding:

- Raster map tiles are requested through MapMe's same-origin caching proxy.
- Nominatim search runs only when the user presses **Search**.
- Tile requests include the attribution and identification expected by OpenStreetMap's services.
- MapMe never prefetches map areas.

## 🧭 Tiles and geocoding

The default raster tiles come from OpenStreetMap and display the required attribution. MapMe
proxies requested tiles through its own origin, maintains an HTTP-aware cache, conditionally
revalidates expired tiles, and can serve stale cached tiles during a temporary upstream outage.
This also avoids requiring privacy-focused browsers to send cross-origin referrers.

Public Nominatim search is enabled by default, globally limited to one request per second, and
cached. Do not enable `GEOCODING_AUTOCOMPLETE` against the public Nominatim endpoint; its policy
does not permit autocomplete. Direct coordinates, map clicks, and manual addresses continue to
work when geocoding is disabled.

Advanced operators can override storage, tile, geocoding, cache, upload, import, and restore
settings using the values documented in [`.env.example`](.env.example). `ORIGIN`, `AUTH_MODE`, and
the related authentication variables remain available as bootstrap values for automated or legacy
deployments; normal installations should use the setup page.

## 💾 Data and backups

MapMe is built to make leaving as easy as arriving:

- **GeoJSON** is the canonical interchange format.
- **CSV** uses a stable, human-readable header.
- **KML** imports point placemarks and converts embedded HTML to text.
- **GPX** imports waypoints and recognizes OsmAnd Favorites exports.
- Imports are previewed before commit, and likely duplicates are skipped unless explicitly copied.
- ZIP backups contain a consistent SQLite snapshot, uploads, SHA-256 checksums, and a manifest.
- Browser restores are inspected and staged, then activated with one deliberate restart.

If database damage prevents the normal UI from starting, restore a backup from a temporary
container:

```sh
docker run --rm -it \
  -v /path/to/mapme-data:/data \
  ghcr.io/tylxr59/mapme:latest \
  restore-backup /data/backups/mapme-backup-....zip
```

The previous database and uploads are retained under `/data/backups/rollback-*`.

## 🧰 Technology

| Layer       | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| Application | [SvelteKit](https://svelte.dev/docs/kit) and TypeScript     |
| Map         | [Leaflet](https://leafletjs.com/) and Leaflet.markercluster |
| Storage     | SQLite with FTS5                                            |
| Icons       | [Lucide](https://lucide.dev/icons/)                         |
| Images      | Sharp                                                       |
| Runtime     | Node.js 24 in a health-checked Docker container             |

Released images support `linux/amd64` and `linux/arm64`. Each release is tested, includes an SBOM
and build provenance, and is published to the
[GitHub Container Registry](https://github.com/tylxr59/MapMe/pkgs/container/mapme).

## 👋 Development

Node.js 24 is required.

```sh
cp .env.example .env
npm install
npm run dev
```

Run the complete local verification suite:

```sh
npm run format:check
npm run lint
npm run check
npm test
npm run build
npm run test:e2e
```

Database access is isolated under `src/lib/server/db`, server inputs are validated with Zod, and
immutable numbered migrations live under `migrations`.

Contributions and bug reports are welcome through
[GitHub Issues](https://github.com/tylxr59/MapMe/issues).

## 📦 Releases

Tags such as `v1.2.3` publish `1.2.3`, `1.2`, `1`, and `latest` container tags. Prereleases publish
only their exact version. See the [release history](https://github.com/tylxr59/MapMe/releases) for
changes and upgrade notes.

## 🤝 Acknowledgements

MapMe is built on the work of the [OpenStreetMap](https://www.openstreetmap.org/) community,
[Leaflet](https://leafletjs.com/), [Lucide](https://lucide.dev/), and the wider open-source
ecosystem.

## 📃 License

MapMe is available under the [MIT License](LICENSE).
