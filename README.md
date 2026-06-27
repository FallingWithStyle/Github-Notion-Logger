# GitHub Activity Logger

**Formerly GitHub Notion Logger.** A local service that ingests GitHub commits and exposes a small read API. Primary consumer: [Devra](../Devra) (`devra report`, `devra ask`, `devra focus`).

> **v2 rework in progress.** See [`REWORK_PLAN.md`](REWORK_PLAN.md) and [`rework-task-list.md`](rework-task-list.md). Legacy v1 (Notion sync, Epic 9/10 UI, AI assistant) is being archived.

## Overview

| v2 (target) | v1 (legacy, being archived) |
|-------------|----------------------------|
| SQLite commit store | Notion as primary store |
| Devra read API on port **3040** | Fly.io + multi-page dashboard |
| Devra as visual layer | In-app AI, project health, weekly planning |

**Frozen during rework:** root commit heatmap (`/` + `commit-log.json`) — unchanged until backlog G8.

## Features (v2 target)

- GitHub webhook ingest with signature verification
- Per-commit SQLite storage (G1+)
- Devra contract API: `/health`, `/api/projects`, `/api/activity`, `/api/projects/:id/commits`
- GitHub API backfill for history
- Optional legacy heatmap at `/` (daily aggregates)

## Prerequisites

- Node.js 18+
- GitHub Personal Access Token (backfill)
- GitHub webhook secret (real-time ingest)
- pm2 (recommended, via [Switchboard](../Switchboard))

## Quick start

```bash
npm install
cp .env.template .env   # edit secrets
npm start
```

Default URL: **http://127.0.0.1:3040**

Health check:

```bash
curl http://127.0.0.1:3040/health
# {"status":"ok","version":"2.0.0"}
```

### pm2 (recommended)

```bash
pm2 start ecosystem.config.js --only github-activity-logger
pm2 logs github-activity-logger
```

Register with Switchboard port **3040** (see G3 in `rework-task-list.md`).

## Configuration

| Variable | Purpose |
|----------|---------|
| `HOST` | Bind address (default `127.0.0.1`) |
| `PORT` | HTTP port (default `3040`) |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC verification |
| `GITHUB_TOKEN` | Backfill / GitHub API |
| `DATA_DIR` | Data directory (`./data`) |
| `GITHUB_LOGGER_TOKEN` | Optional bearer auth for read API |
| `NOTION_SYNC` | `false` during rework |

Devra connects with `GITHUB_LOGGER_URL=http://127.0.0.1:3040` — see [`../Devra/Docs/github-logger-connection.md`](../Devra/Docs/github-logger-connection.md).

## Project structure (target)

```
server.js              # HTTP server
db/                    # SQLite schema + store (G1)
ingest/                # webhook, backfill, commit-parser (G1–G2)
routes/api-devra.js    # Devra contract endpoints (G3)
config/projects.json   # repo ↔ workspacePath mapping (G1)
archive/legacy-notion-era/  # v1 code (Epic A)
```

## Development

```bash
npm test
```

Legacy v1 task list: [`task-list.md`](task-list.md) (historical). Active rework tasks: [`rework-task-list.md`](rework-task-list.md).

## Legacy v1 documentation

- [`docs/API_V2_DOCS.md`](docs/API_V2_DOCS.md) — Epic 9 API (do not extend for Devra)
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — full v1 API reference

## License

See repository license. Personal utility project.

## Acknowledgements

Built for personal commit tracking across repos under `~/Documents/Projects/Dev`, integrated with Devra v3.1+.
