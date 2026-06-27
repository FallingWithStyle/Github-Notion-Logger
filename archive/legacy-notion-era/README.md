# Legacy v1 — GitHub Notion Logger (Notion era)

**Archived:** 2026-06-27  
**Replaced by:** GitHub Activity Logger v2 (hot path at repo root)

This tree is **not mounted** by `server.js`. Kept for reference, occasional read-only inspection, and optional `NOTION_SYNC=true` Notion logging from the archived `notion.js` module.

## What moved here

| Area | Contents |
|------|----------|
| **Notion sync** | `notion.js`, `services/notion/` |
| **AI / assistant** | `gnl-assistant.js`, `services/ai-*`, `services/llama-hub-service.js`, `routes/ai-chat.js`, `routes/ai-proxy.js` |
| **Epic 9/10 API** | `routes/api-v2.js`, `api-remaining.js`, `api-docs.js`, weekly/planning/progress/prd routes |
| **Epic 9/10 UI** | `public/progress-v2.html`, `projects-v2.html`, `ai-chat.html`, `week.html`, etc. |
| **Services** | `project-management-service.js`, `progress-tracking-service.js`, `data-consistency-service.js`, extra `services/server/*` |
| **Scripts** | `wanderlog-processor.js`, Notion maintenance, backfill (`backfill.js`), dedupe, PRD processors |
| **Deploy** | `deploy/fly.toml`, `deploy/Dockerfile`, `test-deploy.js` |
| **Tests** | v1 Jest suite (Epic 9/10, AI, Notion, Wanderlog) |
| **Docs** | Epic 9/10 architecture, GNL assistant, Llama hub docs |

## v1 entry points removed from hot path

- `POST /api/webhook` — still at repo root `routes/webhook.js` (Notion optional via `NOTION_SYNC`)
- All `/api/v2/*`, `/api/ai/*`, weekly planning, wanderlog, project health APIs
- Multi-page UI except frozen heatmap at `/`

## v1 hosting (decommission in G7)

- **Fly app:** `notion-logger` → `https://notion-logger.fly.dev`
- **Fly volume:** `/data` (commit-log.json, palettes)
- **Env references (no secrets in git):** `NOTION_API_KEY`, `NOTION_COMMIT_FROM_GITHUB_LOG_ID`, `NOTION_DATABASE_ID`, `OPENAI_API_KEY`

## Running archived code (not recommended)

Requires restoring files to original paths or running scripts directly from this folder with adjusted `require` paths. For historical backfill via Notion-era `backfill.js`:

```bash
cd archive/legacy-notion-era
# Not supported on hot path — use G2 GitHub backfill on v2 instead
```

## Hot path after archive (repo root)

| Keep | Role |
|------|------|
| `server.js` | Thin Express |
| `routes/webhook.js` | GitHub webhook → `commit-log.json` |
| `routes/static.js` | Heatmap `/`, `/commit-log.json` |
| `routes/heatmap-api.js` | `/api/weekly-data` colors shim |
| `routes/timezone.js`, `routes/color-palette.js` | Heatmap settings |
| `services/server/commit-processing-service.js` | JSON aggregation |
| `scripts/timezone-config.js`, `scripts/color-palette.js` | Heatmap support |

See `REWORK_PLAN.md` and `rework-task-list.md` for G1+ (SQLite, Devra API).
