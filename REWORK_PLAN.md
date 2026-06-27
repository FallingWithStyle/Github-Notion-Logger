# GAL Rework Plan

**Created:** 2026-06-27  
**Purpose:** Handoff document for reworking **GitHub Activity Logger (GAL)** in `../github-notion-logger` into a stable, focused commit-activity service that Devra v3.1 can consume read-only.

**Abbreviation:** **GAL** = GitHub Activity Logger (formerly GNL / GitHub Notion Logger).

**Devra connection contract (consumer side):** `../Devra/Docs/github-logger-connection.md`

---

## New identity

**Today:** GitHub → Notion (+ JSON file + multiple UIs + AI assistant + weekly planning + Fly.io + reconciliation across three data sources). Too broad; Notion as source of truth is the main reliability problem.

**Target:** **GitHub Activity Logger** — a local service that records commits per repo/project and exposes a small read API. Personal utility; **Devra is the primary consumer** for cross-project reports, Q&A, and prioritization.

| GAL owns | Devra owns |
|---|---|
| GitHub webhook + backfill | Cross-project Q&A, prioritization, reports |
| Local DB (commits, projects) | Task lists, PRDs, git on disk, CCLIVE sessions |
| `workspacePath` → folder mapping | Joining logger data with project scanner |
| Read API (JSON) | **Visual layer** — `devra report`, `devra ask`, `devra focus` |

**Rule:** If Devra can answer it with Cursor Auto + richer context, remove it from GAL (AI chat, Llama assistant, project-health scoring that duplicates Devra).

**Visual layer:** Treat **Devra as the dashboard** for cross-project work history. GAL is data tracking + API, not a product UI. A dedicated “what did I ship?” view belongs in Devra, not a revived v1 multi-page app.

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
| **Fly.io as default runtime** | Local pm2 + Tailscale first (same pattern as CCLIVE); see [Hosting decision](#hosting-decision-flyio-vs-local) |
| **Epic 9/10 multi-page UI** (`progress-v2`, `projects-v2`, AI chat pages) | Archive; use Devra for cross-project views |
| **New heatmap / activity UI** | Deprioritized — see [Legacy heatmap (frozen)](#legacy-heatmap-frozen) |
| **`data-consistency-service`** (GitHub vs Notion vs JSON) | Single source of truth eliminates reconciliation |
| **api-v2 “project health” / PRD scoring** | Devra scanner reads disk; logger only needs commits + last activity |

### Salvage (do not rewrite from scratch)

- Webhook handling + GitHub signature verification
- Commit parsing / insignificant-commit filtering (extract into `ingest/commit-parser.js`; logic currently scattered in `wanderlog-processor.js` and Notion paths)
- `backfill.js` patterns (Octokit, rate limiting, repo iteration)
- `commit-processing-service.js` timezone/date bucketing concepts (ingest only; read API uses UTC — see below)
- Repo → project name mapping concept
- Notion `getExistingCommitsForRepo` SHA dedup ideas (port to SQLite `PRIMARY KEY (sha)`)

**Do not treat `data/commit-log.json` as a migration source for per-commit rows.** It stores daily **counts** per project (`{ date, projects: { "Repo-Name": 90 } }`), not `sha`, `message`, `author`, or `url`. Use it only to **validate** aggregate totals after GitHub backfill.

### Legacy heatmap (frozen)

Existing heatmap stack — **leave as-is during rework**; do not rebuild, remove, or migrate to the new API yet:

| Piece | Location | Role |
|---|---|---|
| Daily aggregate file | `data/commit-log.json` | Per-day commit counts per project |
| Webhook aggregation | `services/server/commit-processing-service.js` | Updates JSON on ingest |
| Heatmap UI | `public/js/index/index.js` + `/commit-log.json` route | Root-page contribution grid |
| Timezone bucketing | `scripts/timezone-config.js` | Daily bucket boundaries for JSON |

**Policy:**

- **Deprioritized** — no new heatmap UI, no G5 rebuild, no `GET /api/activity/daily` unless needed later.
- **Frozen** — keep writing `commit-log.json` from webhook alongside SQLite ingest if the legacy page should keep working; do not refactor the heatmap to call contract endpoints.
- **Revivable** — SQLite + per-commit rows make a future heatmap (GAL or Devra) easier; optional `/api/activity/daily` remains documented in the Devra contract as nice-to-have, not a rework deliverable.

---

## What to build (focused core)

### 1. SQLite as single source of truth

Greenfield **storage layer**, brownfield **ingest patterns**. Not a full rewrite of the app shell.

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
  committed_at TEXT NOT NULL,    -- ISO8601 UTC
  url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX idx_commits_project_time ON commits(project_id, committed_at);
```

**Ingest path:** webhook and backfill **only write SQLite**. No Notion on the hot path.

**Time semantics:** Store `committed_at` as GitHub’s UTC timestamp. Query `/api/activity` with plain ISO8601 `since`/`until` range comparison. Do **not** apply timezone cutoff bucketing on the read API (legacy `timezoneConfig.getEffectiveDate()` was for daily heatmap JSON, not contract queries).

**Optional later:** `notion-export` job reads SQLite → Notion (one-way, best-effort). Not blocking.

**Library:** `better-sqlite3` — sync, simple, fine for single-user local service. Note: native bindings complicate multi-instance cloud deploy; acceptable because steady-state is local.

### 2. Project config with Devra join key

`config/projects.json` (seed DB from this file on startup):

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

**Unknown repo on webhook** (pick explicit behavior in G1):

| Policy | Behavior |
|---|---|
| **Recommended: log + skip** | Accept webhook (202), log warning, do not insert commits until repo is added to `projects.json` |
| Alternative: auto-insert | Create project row with `workspace_path` null; appears in API but won’t cross-join in Devra until mapped |

**Auto-discovery (later):** scan workspace root for git remotes and suggest mappings. Manual config is fine for v1.

### 3. Devra read API (required)

Implement exactly as defined in `../Devra/Docs/github-logger-connection.md`. **Clean cut:** legacy Epic 9 routes do not coexist on contract paths.

#### Route strategy

Legacy `routes/api-v2.js` already mounts `GET /api/projects` with a **different shape** (pagination, health scores, Notion/cache). Contract paths must be owned exclusively by `routes/api-devra.js`.

| When | Action |
|---|---|
| **G1** | Stop mounting legacy api-v2, ai-chat, ai-proxy on hot path (move to archive) |
| **G3** | Contract routes own `/health`, `/api/projects`, `/api/activity`, `/api/projects/:id/commits` |

Do **not** use a transitional `/api/v2/devra/*` prefix — Devra expects `GITHUB_LOGGER_URL=http://127.0.0.1:3040` with `/api/projects` at the root.

| Endpoint | Implementation |
|---|---|
| `GET /health` | `{ "status": "ok", "version": "2.0.0" }` — no Notion, DB, or GitHub dependency |
| `GET /api/projects` | Query `projects` + `MAX(committed_at)` from `commits` |
| `GET /api/activity?since=&until=` | `GROUP BY project_id`: count, last commit time, last message; echo `since`/`until` in response |
| `GET /api/projects/:id/commits?since=&limit=` | Indexed query on `commits`; 404 if project id unknown |

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

**Example `/api/activity` response** (must echo window):

```json
{
  "since": "2026-06-20T00:00:00Z",
  "until": "2026-06-27T23:59:59Z",
  "projects": [
    {
      "id": "devra",
      "name": "Devra",
      "commitCount": 3,
      "lastCommitAt": "2026-06-27T12:00:00Z",
      "lastCommitMessage": "docs: add v3.1 phased plan"
    }
  ]
}
```

**Error responses:** `400` for malformed `since`/`until`; `404` for unknown `:id`; `401` when bearer auth enabled and token missing/invalid.

**Optional auth:** `Authorization: Bearer $GITHUB_LOGGER_TOKEN` when exposed via Tailscale.

**Optional endpoints (not blocking Devra Phase 3; deprioritized for now):**

- `GET /api/activity/daily?days=28` — future heatmap input (legacy UI uses `commit-log.json` instead)
- `GET /api/projects/:id/summary?days=7` — pre-aggregated weekly blurb

Devra can compute aggregates from commits if only the required four endpoints exist. Do not build optional endpoints until there is a concrete consumer.

#### G3 acceptance criteria (`curl`)

Run against `http://127.0.0.1:3040` after G3; shapes must match `../Devra/Docs/github-logger-connection.md`.

```bash
curl -s http://127.0.0.1:3040/health
curl -s http://127.0.0.1:3040/api/projects
curl -s 'http://127.0.0.1:3040/api/activity?since=2026-06-20T00:00:00Z&until=2026-06-27T23:59:59Z'
curl -s 'http://127.0.0.1:3040/api/projects/devra/commits?since=2026-06-20T00:00:00Z&limit=50'
```

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
│   └── commit-parser.js    # insignificant-commit filter; shared by webhook + backfill
├── routes/
│   ├── api-devra.js        # contract endpoints only
│   └── webhook.js
├── config/
│   └── projects.json
└── archive/
    └── legacy-notion-era/  # notion.js, api-v2, ai routes, old UIs
```

### 5. Runtime: local-first

| Setting | Value |
|---|---|
| **Bind** | `127.0.0.1` default; optional Tailscale IP for phone/remote read (CCLIVE pattern) |
| **Port** | `3040` — see [Port allocation (Switchboard)](#port-allocation-switchboard) |
| **Process** | pm2 app `github-activity-logger` (new); retire `gnl-assistant` from hot path |
| **Data** | `DATA_DIR` → `./data/activity.db` (SQLite) |

**Env vars (minimum):**

| Var | Purpose |
|---|---|
| `PORT` | HTTP port (default `3040`) |
| `HOST` | Bind address (default `127.0.0.1`) |
| `GITHUB_WEBHOOK_SECRET` | Webhook verification |
| `GITHUB_TOKEN` | Backfill / API access |
| `DATA_DIR` | SQLite directory (e.g. `./data`) |
| `GITHUB_LOGGER_TOKEN` | Optional bearer auth for read API |
| `NOTION_SYNC` | `false` during rework; remove Notion from hot path |

**pm2 (add to repo `ecosystem.config.js` and Switchboard `ecosystem-all.config.js`):**

```js
{
  name: 'github-activity-logger',
  script: 'server.js',
  cwd: '/Users/patrick/Documents/Projects/Dev/github-notion-logger',
  env: { PORT: 3040, HOST: '127.0.0.1', NOTION_SYNC: 'false' }
}
```

#### Webhook ingress (local)

GitHub must reach the webhook URL. Options while Fly is retired:

| Option | Pros | Cons |
|---|---|---|
| **Tailscale Funnel** (subset of routes) | No third party; same tailnet tooling as CCLIVE | Funnel setup; URL changes if misconfigured |
| **Keep Fly app as webhook-only relay** | Existing `notion-logger.fly.dev` URL may already be registered in GitHub | Extra moving part; defeats “local-first” unless relay is trivial |
| **smee.io / Cloudflare Tunnel** | Quick dev setup | External dependency |
| **Manual backfill only** | Simplest | Misses real-time pushes |

**Recommendation:** Tailscale Funnel on `POST /webhook` once local ingest is stable; run periodic `ingest/backfill.js` as safety net. Document chosen approach in README.

---

### Port allocation (Switchboard)

**Verified against** `../Switchboard/LOCALHOSTS_LIST.md` (2026-06-27):

| Check | Result |
|---|---|
| Port `3040` in reserved range `3040-3049` | **Available** (DevSquire retired 2026-06-25) |
| Devra contract `GITHUB_LOGGER_URL` | `http://127.0.0.1:3040` — **matches** |
| Conflicts with Switchboard dashboard | **None** (Switchboard uses `8080`) |
| Legacy v1 main server | Was `8080` in code (conflicts with Switchboard) and `8100` in archived Switchboard doc — **both wrong for rework** |
| `gnl-assistant` on `4250` | Archived with v1; **not** the reworked GAL service |

**Register on G3:**

1. Add `3040 | github-activity-logger` to `../Switchboard/LOCALHOSTS_LIST.md` under a new **GitHub Activity Logger (3040-3049)** group (reserve `3041` for optional health/admin later).
2. Add pm2 entry to `../Switchboard/ecosystem-all.config.js`.
3. Add service to `../Switchboard/config.json`.
4. Add `3040` to the port validation script in LOCALHOSTS_LIST.

Placing `3040` adjacent to Devra (`3030-3039`) is intentional — same machine, same consumer.

---

## Hosting decision: Fly.io vs local

### Current Fly setup

- App: `notion-logger` (`notion-logger.fly.dev`)
- Port `8080`, volume mount at `/data`
- `auto_stop_machines = stop`, `min_machines_running = 0` (cold starts)
- Hosted full legacy stack: Notion sync, multi-page UI, api-v2, AI proxy to local `gnl-assistant`

### What the rework actually needs

| Need | Local pm2 | Fly.io |
|---|---|---|
| Devra read API (`127.0.0.1:3040`) | Native | Awkward (Devra on same Mac) |
| SQLite single-writer DB | Natural on disk | Volume works; bad for multi-machine scale |
| GitHub webhook receiver | Needs tunnel/Funnel/relay | Public URL (today’s main Fly benefit) |
| Legacy heatmap (frozen) | Existing `commit-log.json` + index page | Fly-hosted today; not a rework target |
| Cost | Free (your hardware) | Per-VM + volume; already drove assistant local |
| Complexity | Low (CCLIVE precedent) | Dockerfile, deploy, cold starts, Notion env on server |

### Recommendation

| Component | Steady-state hosting |
|---|---|
| **Ingest + SQLite + read API** | **Local pm2** on `127.0.0.1:3040` |
| **Devra consumption** | Local HTTP (no cloud hop) |
| **Cross-project visual layer** | **Devra** (`devra report`, etc.) |
| **Legacy heatmap** | Frozen on existing stack; revivable later from SQLite if wanted |
| **Fly.io (`notion-logger`)** | **Retire after webhook ingress is replaced** — do not rebuild the reworked service on Fly by default |

**Do not host a reworked v1 dashboard on Fly.** Steady-state UI is Devra; the legacy heatmap may keep working locally until you retire or rebuild it.

**Transitional plan for Fly:**

1. **G1–G3:** Develop and run entirely local; point Devra at `127.0.0.1:3040`.
2. **Webhook cutover:** Move GitHub webhook URL from `notion-logger.fly.dev` to Tailscale Funnel (or run backfill on a schedule until cutover).
3. **Decommission:** Scale Fly app to 0 / destroy after confirming ingest works locally for 1–2 weeks.
4. **Keep artifacts:** Leave `fly.toml` + `Dockerfile` in `archive/legacy-notion-era/` for reference, not hot path.

**When Fly would still make sense (unlikely for this project):**

- You need 24/7 webhook ingest while the Mac is routinely off (then a tiny webhook-forwarder on Fly, not the full app + SQLite).
- You want a public demo URL unrelated to Devra (not a stated goal).

---

## Phased rework

| Phase | GAL work | Devra |
|---|---|---|
| **G1** | SQLite schema + webhook → DB only; stop Notion on ingest; archive legacy routes from hot path; **keep** `commit-log.json` aggregation for frozen heatmap | Parallel (v3.0, no logger dependency) |
| **G2** | **GitHub API backfill** → per-commit rows in SQLite; optional Notion one-time export for gap-fill; use `commit-log.json` only to validate aggregate counts | — |
| **G3** | Devra contract endpoints + `projects.json` + Switchboard port registration; pass `curl` acceptance criteria | Can start `github-logger-client.js` |
| **G4** | Harden: idempotent webhook, SHA dedup, restart-safe; **contract API tests**; quarantine legacy test suite with archived code | Wire `devra report` |
| **G6** | Optional: Notion one-way export, weekly digest export | — |
| **G7** | Webhook ingress cutover; decommission Fly `notion-logger` | — |
| **G8** *(backlog)* | Heatmap revival — new UI on contract API or Devra; only if wanted | — |

**Ship G1–G3 before Notion export or Fly retirement.** No new GAL UI work before G8 backlog.

---

## Standalone utility (without Devra)

The rework should be useful on its own:

1. **Trustworthy ingest** — every push logged once, survives restarts, backfill fills gaps
2. **`GET /api/activity?since=...`** — “what did I ship this week?” in JSON
3. **Project last-touch dates** — repos sorted by `lastCommitAt`
4. **No manual Notion fetch** — remove sync/fetch-notion flows from daily use

Cross-project “what did I ship?” views: use **Devra** or `curl` the contract API. Legacy root heatmap remains frozen, not extended.

---

## Overlap with Devra (avoid duplication)

| Capability | GAL | Devra |
|---|---|---|
| Commit history / shipped work | **Store + API** | Read via client |
| Cross-project visual / reports | No (legacy heatmap frozen) | **`devra report`**, ask, focus |
| “What should I focus on?” | No | **`devra focus`** |
| PRD / task-list status | No | Scanner |
| Agent session activity | No | CCLIVE reader |
| AI Q&A | No | Cursor Auto |
| Project health from PRD analysis | No | Scanner + ask |

GAL = **dumb storage, stable API**. Devra = **smart synthesis**.

---

## Concrete first steps

1. Add `db/schema.sql` + `db/store.js`; wire webhook to insert commits into SQLite.
2. Add `ingest/commit-parser.js`; apply insignificant-commit filter on webhook and backfill.
3. Set `NOTION_SYNC=false` and remove `logCommitsToNotion` from the webhook hot path.
4. Add `config/projects.json` with `workspacePath` for monitored repos; document unknown-repo policy.
5. Archive legacy routes (`api-v2`, ai routes, old UIs) — contract paths must not collide.
6. Implement the four contract endpoints; pass G3 `curl` acceptance criteria.
7. Register port `3040` in `../Switchboard/LOCALHOSTS_LIST.md` + pm2 configs.
8. Update README: new purpose, local pm2 on `3040`, webhook ingress plan, pointer to Devra connection doc.

When **G3** is complete, Devra Phase 3 (`github-logger-client.js`) can integrate. If the API shape changes, update **`../Devra/Docs/github-logger-connection.md` first**, then both codebases.

---

## References

| Doc | Path |
|---|---|
| This plan | `REWORK_PLAN.md` |
| Rework task list | `rework-task-list.md` |
| Devra read API contract | `../Devra/Docs/github-logger-connection.md` |
| Devra v3 / v3.1 roadmap | `../Devra/Docs/devra-v3-migration-plan.md` |
| Switchboard port registry | `../Switchboard/LOCALHOSTS_LIST.md` |
| Legacy API v2 (do not extend for Devra) | `docs/API_V2_DOCS.md` |
| CCLIVE local + Tailscale pattern | `../CCLIVE/README.md` |

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-27 | Initial rework plan aligned with Devra v3.1 Phase 3 |
| 2026-06-27 | Refinements: G2 backfill reality, route clean-cut, port 3040 Switchboard verification, ingest edge cases, G3 acceptance curls, Fly.io hosting decision, webhook ingress options |
| 2026-06-27 | Devra as visual layer; heatmap deprioritized (legacy stack frozen, G8 backlog) |
| 2026-06-27 | Added `rework-task-list.md` walkthrough (R0 rename, Epic A v1 archive, G1–G8) |
| 2026-06-27 | GNL → GAL naming pass in plan and cross-repo docs |
