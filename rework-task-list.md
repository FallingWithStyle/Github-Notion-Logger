# GitHub Activity Logger — Rework Task List

Walkthrough for `REWORK_PLAN.md`. Replaces the v1 (GitHub Notion Logger) product direction with a local commit-ingest service and Devra read API.

## Project Metadata

- **Project name**: GitHub Activity Logger (formerly GitHub Notion Logger)
- **Project ID**: GITHUB-ACTIVITY-LOGGER-002
- **Version**: 2.0 (rework)
- **Plan**: `REWORK_PLAN.md`
- **Devra contract**: `../Devra/Docs/github-logger-connection.md`
- **Last updated**: 2026-06-27

## How to use this list

- `- [ ]` incomplete · `- [x]` done · `- [>]` deferred / backlog
- Complete **Epic R0** and **Epic A** early so the hot path is clear before G1–G3.
- Ship **G1 → G2 → G3** before G4, G6, G7. **G8** is optional backlog.
- Legacy v1 task list (`task-list.md`) is historical; do not extend it for rework work.

---

## Epic R0: Identity — GitHub Notion Logger → GitHub Activity Logger

**Goal**: Rename the product everywhere that matters; repo folder `github-notion-logger` may stay for now to avoid path churn.

### Story R0.1: Package and runtime identity

- [x] Update `package.json` `name`, `description`, and `version` (e.g. `2.0.0`) to GitHub Activity Logger
- [x] Add pm2 app `github-activity-logger` in repo `ecosystem.config.js` (`PORT=3040`, `HOST=127.0.0.1`)
- [x] Default `PORT` to `3040` and `HOST` to `127.0.0.1` in `server.js` and `.env.template`
- [x] Set service display name in startup logs and `GET /health` version to `2.0.0`

### Story R0.2: Documentation and references

- [x] Rewrite `README.md` for v2 purpose (local ingest, SQLite, Devra API, pm2 on 3040)
- [x] Add “formerly GitHub Notion Logger” note in README for search/bookmarks
- [x] Point README to `REWORK_PLAN.md`, `rework-task-list.md`, and Devra connection doc
- [x] Archive or supersede v1-centric docs (`docs/API_V2_DOCS.md`, Epic 9/10 docs) — move to archive with v1 code or add top banner “legacy v1”

### Story R0.3: User-facing strings and integrations

- [x] Replace “GitHub Notion Logger” / “GNL” product labels in remaining hot-path code and HTML titles (keep `gnl-assistant` name only inside archived tree until removed)
- [x] Update Switchboard service label to `github-activity-logger` when registering port 3040 (G3)
- [>] Optional later: rename git repo / folder `github-notion-logger` → `github-activity-logger`

---

## Epic A: Archive v1 (legacy Notion era)

**Goal**: Move v1 off the hot path into `archive/legacy-notion-era/`; verify server starts with only v2 routes + frozen heatmap.

### Story A.1: Archive layout and inventory

- [ ] Create `archive/legacy-notion-era/README.md` — what moved, why, date, how to run read-only if needed
- [ ] Snapshot v1 behavior note: last known Fly URL, Notion DB IDs (references only, no secrets in git)
- [ ] List v1 entry points removed from hot path in archive README

### Story A.2: Notion and sync stack

- [ ] Move `notion.js` → `archive/legacy-notion-era/`
- [ ] Move `services/notion/` → `archive/legacy-notion-era/services/notion/`
- [ ] Move `services/data-consistency-service.js` → archive
- [ ] Move `scripts/wanderlog-processor.js` and wanderlog one-off scripts → archive (or `archive/legacy-notion-era/scripts/`)
- [ ] Move Notion-only maintenance scripts (`notion-audit.js`, `clear-recent-notion.js`, etc.) → archive

### Story A.3: AI assistant and proxy

- [ ] Move `gnl-assistant.js` → archive
- [ ] Move `routes/ai-chat.js`, `routes/ai-proxy.js` → archive
- [ ] Move `services/llama-hub-service.js`, `services/ai-*` (cache, context, session, circuit-breaker, etc.) → archive
- [ ] Move `models/ai-models.js` → archive
- [ ] Move `config/start-gnl-assistant.sh` → archive
- [ ] Remove `gnl-assistant` from repo `ecosystem.config.js` hot path (Switchboard archive in Story A.6)

### Story A.4: Epic 9/10 API and services

- [ ] Move `routes/api-v2.js` → archive
- [ ] Move `routes/api-remaining.js` (legacy portions) → archive or split; keep only what v2 still needs until replaced
- [ ] Move `routes/prd-stories.js`, `routes/weekly-planning.js`, `routes/project-progress.js` → archive
- [ ] Move `services/project-management-service.js`, `services/progress-tracking-service.js` → archive
- [ ] Move `routes/api-docs.js` (v1 API catalog) → archive; replace with short v2 note in README if needed

### Story A.5: Epic 9/10 UI (multi-page)

- [ ] Move `public/progress-v2.html`, `public/js/progress-v2/` → archive
- [ ] Move `public/projects-v2.html`, `public/js/projects-v2/` → archive
- [ ] Move `public/ai-chat.html`, `public/js/ai-chat.js` → archive
- [ ] Move `public/projects.html`, `public/js/projects/` → archive if superseded (keep root heatmap — Story A.7)
- [ ] Move `public/week.html`, `public/js/week/` → archive
- [ ] Move associated CSS-only pages tied to archived UIs → archive

### Story A.6: Fly.io and deploy artifacts

- [ ] Move `fly.toml`, `config/fly.toml`, `Dockerfile`, `test-deploy.js` → `archive/legacy-notion-era/deploy/`
- [ ] Document Fly app `notion-logger` decommission in archive README (actual destroy in Epic G7)

### Story A.7: Keep on hot path (do not archive)

- [ ] **Keep** root heatmap: `public/index.html` (or equivalent), `public/js/index/`, `routes/static.js` `/commit-log.json`
- [ ] **Keep** `services/server/commit-processing-service.js` for frozen `commit-log.json` aggregation
- [ ] **Keep** `scripts/timezone-config.js` for heatmap daily buckets
- [ ] **Keep** `routes/webhook.js` (rewire to SQLite in G1, retain JSON side-write if desired)

### Story A.8: Wire hot path after archive

- [ ] Slim `server.js` — remove imports for archived modules
- [ ] Slim `routes/index.js` — mount only webhook, `api-devra`, static/heatmap
- [ ] Quarantine v1 tests: move `tests/test-epic9-*`, `tests/test-ai-*`, `tests/test-notion-*`, etc. → `archive/legacy-notion-era/tests/` or exclude in `jest.config.js`
- [ ] Verify `npm test` runs only v2-relevant tests (or minimal smoke) after quarantine
- [ ] Smoke: server starts on 3040, `GET /health`, webhook route exists, heatmap page loads locally

### Story A.9: Switchboard cleanup for archived v1

- [ ] Remove or archive `gnl-assistant` entry from `../Switchboard/ecosystem-all.config.js` and `ecosystems/gnl-assistant.config.js` when assistant is archived
- [ ] Remove port `4250` gnl-assistant from active Switchboard docs when retired (or mark archived)

---

## Epic G1: SQLite ingest (stop Notion on hot path)

**Goal**: Webhook writes per-commit rows to SQLite; Notion removed from ingest; legacy heatmap JSON optional side-write.

### Story G1.1: Database layer

- [ ] Add `db/schema.sql` (projects + commits tables per `REWORK_PLAN.md`)
- [ ] Add `db/store.js` — init, migrations, insert commit (idempotent on sha), project seed from config
- [ ] Add `better-sqlite3` dependency; DB file at `DATA_DIR/activity.db`
- [ ] Implement unknown-repo policy: log + skip commits until repo in `config/projects.json`

### Story G1.2: Ingest pipeline

- [ ] Add `ingest/commit-parser.js` — normalize webhook commit shape, insignificant-commit filter
- [ ] Refactor webhook handler to insert into SQLite via `db/store.js`
- [ ] Set `NOTION_SYNC=false` in `.env.template`; gate any remaining Notion calls behind env flag during transition
- [ ] Remove `logCommitsToNotion` from webhook hot path
- [ ] Keep `updateCommitLog()` call after SQLite insert if frozen heatmap should update (document in README)

### Story G1.3: Project config

- [ ] Add `config/projects.json` with `id`, `name`, `repo`, `workspacePath` for monitored repos
- [ ] Seed `projects` table from JSON on startup
- [ ] Document mapping rules in README (join key for Devra)

---

## Epic G2: Historical backfill

**Goal**: Populate SQLite with per-commit detail from GitHub API; validate aggregates against `commit-log.json`.

### Story G2.1: Backfill into SQLite

- [ ] Move/adapt `backfill.js` → `ingest/backfill.js` — write SQLite instead of Notion
- [ ] Reuse Octokit patterns, rate limits, repo iteration from v1 backfill
- [ ] SHA dedup via `PRIMARY KEY (sha)` on insert
- [ ] Run full backfill for all `config/projects.json` repos

### Story G2.2: Validation and gap-fill

- [ ] Compare daily commit counts: SQLite aggregates vs `data/commit-log.json` (spot-check)
- [ ] `- [>]` Optional: one-time Notion → SQLite export script for gaps GitHub API cannot fill
- [ ] Document backfill command and expected runtime in README

---

## Epic G3: Devra read API and runtime

**Goal**: Four contract endpoints on port 3040; Switchboard registered; Devra can start client integration.

### Story G3.1: Contract API

- [ ] Add `routes/api-devra.js` with `GET /health`, `/api/projects`, `/api/activity`, `/api/projects/:id/commits`
- [ ] Mount at server root paths (no `/api/v2/devra` prefix)
- [ ] Implement query params, error responses (400/404/401), echo `since`/`until` on activity
- [ ] Optional: bearer auth middleware for `GITHUB_LOGGER_TOKEN`

### Story G3.2: Acceptance tests

- [ ] Pass G3 `curl` checklist from `REWORK_PLAN.md` against `http://127.0.0.1:3040`
- [ ] Confirm response shapes match `../Devra/Docs/github-logger-connection.md`

### Story G3.3: Switchboard and pm2

- [x] Register `3040 | github-activity-logger` in `../Switchboard/LOCALHOSTS_LIST.md` (block 3040–3049)
- [x] Add pm2 entry to `../Switchboard/ecosystem-all.config.js`
- [x] Add service to `../Switchboard/config.json`
- [x] Add `3040` to Switchboard port validation script
- [x] Add `../Switchboard/ecosystems/github-activity-logger.config.js`
- [ ] `pm2 start` / Switchboard batch: logger healthy at `curl http://127.0.0.1:3040/health`

---

## Epic G4: Harden and test

**Goal**: Production-trustworthy ingest and API for Devra `devra report` wiring.

### Story G4.1: Ingest reliability

- [ ] Idempotent webhook: duplicate delivery does not duplicate rows
- [ ] Restart-safe: DB WAL mode / clean shutdown documented
- [ ] Insignificant-commit filter covered by unit tests
- [ ] Unknown-repo and missing `projects.json` entry behavior tested

### Story G4.2: Contract API tests

- [ ] Add `tests/api-devra.test.js` (or equivalent) for four endpoints + auth + errors
- [ ] Replace placeholder `tests/test-database-schema.js` with real store tests if useful

### Story G4.3: Devra handoff

- [ ] Notify Devra side: G3 complete, `GITHUB_LOGGER_URL=http://127.0.0.1:3040`
- [ ] `- [>]` Devra repo: implement `github-logger-client.js` (tracked in Devra `task-list.md`)

---

## Epic G6: Optional Notion export (deferred)

**Goal**: One-way SQLite → Notion for nostalgia or dashboards; not on hot path.

- [ ] `- [>]` `scripts/notion-export.js` — read SQLite, best-effort Notion pages
- [ ] `- [>]` Document as optional cron, not required for Devra

---

## Epic G7: Webhook ingress and Fly retirement

**Goal**: Local steady state; GitHub webhooks reach Mac; Fly app decommissioned.

### Story G7.1: Webhook ingress

- [ ] Choose ingress: Tailscale Funnel on `POST /webhook` (recommended) or interim relay
- [ ] Update GitHub repo webhook URL(s) away from `notion-logger.fly.dev`
- [ ] Verify push event → SQLite row within minutes
- [ ] Schedule periodic `ingest/backfill.js` as safety net (document cadence)

### Story G7.2: Decommission Fly

- [ ] Confirm 1–2 weeks stable local ingest after webhook cutover
- [ ] Scale to zero or destroy Fly app `notion-logger`
- [ ] Remove Fly secrets/env from active `.env.template` (keep references in archive README only)
- [ ] Update README: hosting is local-only

---

## Epic G8: Heatmap revival (backlog)

**Goal**: Only if you want a dedicated visual again later; Devra remains primary dashboard until then.

- [ ] `- [>]` Decide: rebuild in Devra vs new GAL static page
- [ ] `- [>]` Optional `GET /api/activity/daily?days=28` from SQLite
- [ ] `- [>]` Replace or retire frozen `commit-log.json` + index heatmap

---

## Completion checklist (v2 shippable)

- [ ] Epic R0: Product renamed to **GitHub Activity Logger** in package, README, logs, Switchboard
- [ ] Epic A: v1 archived under `archive/legacy-notion-era/`; hot path starts clean
- [ ] Epic G1–G3: SQLite ingest, backfill, four Devra endpoints on **3040**
- [ ] Epic G4: Contract tests green; webhook idempotent
- [ ] Epic G7: Fly retired; webhooks hit local service
- [ ] Devra `github-logger-client.js` consuming API (Devra repo)

---

## References

| Doc | Path |
|-----|------|
| Rework plan | `REWORK_PLAN.md` |
| This task list | `rework-task-list.md` |
| v1 task list (historical) | `task-list.md` |
| Devra contract | `../Devra/Docs/github-logger-connection.md` |
| Switchboard ports | `../Switchboard/LOCALHOSTS_LIST.md` |
