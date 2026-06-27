-- GitHub Activity Logger v2 schema (G1)

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo TEXT NOT NULL UNIQUE,
  workspace_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
  sha TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  message TEXT,
  author TEXT,
  committed_at TEXT NOT NULL,
  url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commits_project_time ON commits(project_id, committed_at);
