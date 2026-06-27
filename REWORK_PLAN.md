# GNL Rework Plan

**Created:** 2026-06-27  
**Purpose:** Handoff document for reworking github-notion-logger into a stable, focused commit-activity service that Devra v3.1 can consume read-only.

**Devra connection contract (consumer side):** `../Devra/Docs/github-logger-connection.md`

---

## New identity

**Today:** GitHub → Notion (+ JSON file + multiple UIs + AI assistant + weekly planning + Fly.io + reconciliation across three data sources). Too broad; Notion as source of truth is the main reliability problem.

**Target:** **GitHub Activity Logger** — a local service that records commits per repo/project and exposes a small read API. Personal utility; **Devra is the primary consumer** for cross-project reports, Q&A, and prioritization.

| GNL owns | Devra owns |
|---|---|
| GitHub webhook + backfill | Cross-project Q&A, prioritization, reports |
| Local DB (commits, projects) | Task lists, PRDs, git on disk, CCLIVE sessions |
| `workspacePath` → folder mapping | Joining logger data with project scanner |
| Optional minimal activity UI | `devra report`, `devra ask`, `devra focus` |

**Rule:** If Devra can answer it with Cursor Auto + richer context, remove it from GNL (AI chat, Llama assistant, project-health scoring that duplicates Devra).

---

## What to cut or archive

Move to `archive/legacy-notion-era/` (or delete after verification). Do not maintain on the hot path.

| Remove / defer | Why |
|---|---|
| **Notion as primary store** | Rate limits, schema drift, duplicate cleanup, sync bugs |
| **`gnl-assistant.js` + Llama hub** | Devra uses Cursor Auto |
| **`routes/ai-chat.js`, `routes/ai-proxy.js`** | Same |
| **Weekly planning ↔ Notion sync** | Defer; Devra `devra focus` replaces this eventually |
| **Wanderlog → Notion** | Optional one-way export later, not core |
| **Fly.io as default runtime** | Local pm2 + Tailscale first (same pattern as CCLIVE) |
| **Epic 9/10 multi-page UI** (`progress-v2`, `projects-v2`, AI chat pages) | Defer; `devra report` or one simple heatmap page at most |
| **`data-consistency-service`** (GitHub vs Notion vs JSON) | Single source of truth eliminates reconciliation |
| **api-v2 “project health” / PRD scoring** | Devra scanner reads disk; logger only needs commits + last activity |

### Salvage (do not rewrite from scratch)

- Webhook handling + GitHub signature verification
- Commit parsing / insignificant-commit filtering
- `backfill.js` patterns
- `data/commit-log.json` and `commit-processing-service.js` logic (migrate into DB)
- Repo → project name mapping concept

---

## What to build (focused core)

### 1. SQLite as single source of truth

Promote existing `data/commit-log.json` → SQLite. Not a greenfield app.

**Suggested schema:**

```sql
-- projects: one row per monitored repo
CREATE TABLE projects (
  id TEXT PRIMARY KEY,           -- slug, e.g. "devra"
  name TEXT NOT NULL,
  repo TEXT NOT NULL UNIQUE,     -- "owner/devra"
  workspace_path TEXT,           -- "Devra" → joins DEVRA_PROJECTS_ROOT
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- commits: dedupe on sha
CREATE TABLE commits (
  sha TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  message TEXT,
  author TEXT,
  committed_at TEXT NOT NULL,    -- ISO8601
  url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX idx_commits_project_time ON commits(project_id, committed_at);
```

**Ingest path:** webhook and backfill **only write SQLite**. No Notion on the hot path.

**Optional later:** `notion-export` job reads SQLite → Notion (one-way, best-effort). Not blocking.

**Library:** `better-sqlite3` or equivalent — sync, simple, fine for single-user local service.

### 2. Project config with Devra join key

`config/projects.json` (or seed DB from this file):

```json
[
  {
    "id": "devra",
    "name": "Devra",
    "repo": "your-org/Devra",
    "workspacePath": "Devra"
  },
  {
    "id": "cclive",
    "name": "CCLIVE",
    "repo": "your-org/CCLIVE",
    "workspacePath": "CCLIVE"
  }
]
```

`workspacePath` must match folder names under `~/Documents/Projects/Dev` (`DEVRA_PROJECTS_ROOT` on the Devra side). This is the critical join key for Devra.

**Auto-discovery (later):** scan workspace root for git remotes and suggest mappings. Manual config is fine for v1 of rework.

### 3. Devra read API (required)

Implement exactly as defined in `../Devra/Docs/github-logger-connection.md`. Do not expose legacy Epic 9 api-v2 shapes to Devra — keep the contract stable and separate.

| Endpoint | Implementation |
|---|---|
| `GET /health` | `{ "status": "ok", "version": "2.0.0" }` — no Notion dependency |
| `GET /api/projects` | Query `projects` + `MAX(committed_at)` from `commits` |
| `GET /api/activity?since=&until=` | `GROUP BY project_id`: count, last commit time, last message |
| `GET /api/projects/:id/commits?since=&limit=` | Indexed query on `commits` |

**Example `/api/projects` response:**

```json
{
  "projects": [
    {
      "id": "devra",
      "name": "Devra",
      "repo": "owner/devra",
      "workspacePath": "Devra",
      "lastCommitAt": "2026-06-27T12:00:00Z"
    }
  ]
}
```

**Optional auth:** `Authorization: Bearer $GITHUB_LOGGER_TOKEN` when exposed via Tailscale.

**Optional endpoints (not blocking Devra Phase 3):**

- `GET /api/activity/daily?days=28` — heatmap input
- `GET /api/projects/:id/summary?days=7` — pre-aggregated weekly blurb

Devra can compute aggregates from commits if only the required four endpoints exist.

### 4. Slim server layout (target)

```
github-notion-logger/
├── REWORK_PLAN.md          # this file
├── server.js               # thin Express: health + api + webhook
├── db/
│   ├── schema.sql
│   └── store.js            # all SQLite access
├── ingest/
│   ├── webhook.js
│   ├── backfill.js
│   └── commit-parser.js
├── routes/
│   ├── api-devra.js        # contract endpoints
│   └── webhook.js
├── config/
│   └── projects.json
└── archive/
    └── legacy-notion-era/  # notion.js, ai routes, old UIs
```

### 5. Runtime: local-first

- Default: pm2 on `127.0.0.1:3040` (document port; Devra uses `GITHUB_LOGGER_URL`)
- Optional Tailscale bind (same pattern as CCLIVE)
- Drop Fly.io requirement until local is stable

**Env vars (minimum):**

| Var | Purpose |
|---|---|
| `PORT` | HTTP port (default `3040`) |
| `GITHUB_WEBHOOK_SECRET` | Webhook verification |
| `GITHUB_TOKEN` | Backfill / API access |
| `DATA_DIR` | SQLite path (e.g. `./data`) |
| `GITHUB_LOGGER_TOKEN` | Optional bearer auth for read API |
| `NOTION_SYNC` | `false` during rework; remove Notion from hot path |

---

## Phased rework

| Phase | GNL work | Devra |
|---|---|---|
| **G1** | SQLite schema + webhook → DB only; stop Notion on ingest | Parallel (v3.0, no logger dependency) |
| **G2** | Migrate `commit-log.json` + GitHub backfill into DB | — |
| **G3** | Devra contract endpoints + `projects.json` with `workspacePath` | Can start `github-logger-client.js` |
| **G4** | Harden: idempotent webhook, SHA dedup, restart-safe, API tests | Wire `devra report` |
| **G5** | Optional: minimal `/` activity page calling `/api/activity` | — |
| **G6** | Optional: Notion one-way export, weekly digest export | — |

**Ship G1–G3 before UI or Notion export.**

---

## Standalone utility (without Devra)

The rework should be useful on its own:

1. **Trustworthy ingest** — every push logged once, survives restarts, backfill fills gaps
2. **`GET /api/activity?since=...`** — “what did I ship this week?” in JSON
3. **Project last-touch dates** — repos sorted by `lastCommitAt`
4. **No manual Notion fetch** — remove sync/fetch-notion flows from daily use

If a UI is needed: one static page that calls `/api/activity`. Not five separate apps.

---

## Overlap with Devra (avoid duplication)

| Capability | GNL | Devra |
|---|---|---|
| Commit history / shipped work | **Store + API** | Read via client |
| “What should I focus on?” | No | **`devra focus`** |
| PRD / task-list status | No | Scanner |
| Agent session activity | No | CCLIVE reader |
| AI Q&A | No | Cursor Auto |
| Project health from PRD analysis | No | Scanner + ask |

GNL = **dumb storage, stable API**. Devra = **smart synthesis**.

---

## Concrete first steps

1. Add `db/schema.sql` + `db/store.js`; wire webhook to insert commits into SQLite.
2. Set `NOTION_SYNC=false` and remove `logCommitsToNotion` from the webhook hot path.
3. Add `config/projects.json` with `workspacePath` for monitored repos.
4. Implement the four contract endpoints; verify with `curl` against examples in Devra’s connection doc.
5. Move `notion.js`, AI routes, and legacy UIs to `archive/legacy-notion-era/`.
6. Update README: new purpose, local pm2 setup, pointer to Devra connection doc.

When **G3** is complete, Devra Phase 3 (`github-logger-client.js`) can integrate. If the API shape changes, update **`../Devra/Docs/github-logger-connection.md` first**, then both codebases.

---

## References

| Doc | Path |
|---|---|
| This plan | `REWORK_PLAN.md` |
| Devra read API contract | `../Devra/Docs/github-logger-connection.md` |
| Devra v3 / v3.1 roadmap | `../Devra/Docs/devra-v3-migration-plan.md` |
| Legacy API v2 (do not extend for Devra) | `docs/API_V2_DOCS.md` |

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-27 | Initial rework plan aligned with Devra v3.1 Phase 3 |
