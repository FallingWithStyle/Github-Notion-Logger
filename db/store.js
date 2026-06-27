const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const PROJECTS_CONFIG_PATH = path.join(__dirname, '../config/projects.json');

let db = null;

function getDataDir() {
  const dir = process.env.DATA_DIR
    || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDbPath() {
  return path.join(getDataDir(), 'activity.db');
}

function loadProjectsConfig() {
  if (!fs.existsSync(PROJECTS_CONFIG_PATH)) {
    console.warn(`⚠️ No projects config at ${PROJECTS_CONFIG_PATH}`);
    return [];
  }
  const raw = fs.readFileSync(PROJECTS_CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  if (!Array.isArray(config)) {
    throw new Error('config/projects.json must be a JSON array');
  }
  return config;
}

function initDb() {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  return db;
}

function seedProjectsFromConfig() {
  const database = initDb();
  const config = loadProjectsConfig();
  const now = new Date().toISOString();

  const upsert = database.prepare(`
    INSERT INTO projects (id, name, repo, workspace_path, created_at, updated_at)
    VALUES (@id, @name, @repo, @workspacePath, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      repo = excluded.repo,
      workspace_path = excluded.workspace_path,
      updated_at = excluded.updated_at
  `);

  const seedAll = database.transaction((projects) => {
    for (const project of projects) {
      upsert.run({
        id: project.id,
        name: project.name,
        repo: project.repo,
        workspacePath: project.workspacePath || null,
        now
      });
    }
  });

  seedAll(config);
  console.log(`📁 Seeded ${config.length} projects from config/projects.json`);
}

function getProjectByRepo(repo) {
  return initDb().prepare('SELECT * FROM projects WHERE repo = ? COLLATE NOCASE').get(repo);
}

function getProjectById(id) {
  return initDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function getMostRecentCommitAt(projectId) {
  const row = initDb().prepare(
    'SELECT MAX(committed_at) AS committed_at FROM commits WHERE project_id = ?'
  ).get(projectId);
  return row?.committed_at ? new Date(row.committed_at) : null;
}

function countCommitsInRange(projectId, since, until) {
  const row = initDb().prepare(`
    SELECT COUNT(*) AS count FROM commits
    WHERE project_id = ? AND committed_at >= ? AND committed_at <= ?
  `).get(projectId, since, until);
  return row?.count || 0;
}

function listProjectsWithLastCommit() {
  return initDb().prepare(`
    SELECT p.id, p.name, p.repo, p.workspace_path,
           MAX(c.committed_at) AS last_commit_at
    FROM projects p
    LEFT JOIN commits c ON c.project_id = p.id
    GROUP BY p.id
    ORDER BY p.name COLLATE NOCASE
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    repo: row.repo,
    workspacePath: row.workspace_path,
    lastCommitAt: row.last_commit_at || null
  }));
}

function getActivityInRange(since, until) {
  return initDb().prepare(`
    SELECT p.id, p.name,
           COUNT(c.sha) AS commit_count,
           MAX(c.committed_at) AS last_commit_at,
           (
             SELECT c2.message FROM commits c2
             WHERE c2.project_id = p.id
               AND c2.committed_at >= @since AND c2.committed_at <= @until
             ORDER BY c2.committed_at DESC
             LIMIT 1
           ) AS last_commit_message
    FROM projects p
    INNER JOIN commits c ON c.project_id = p.id
      AND c.committed_at >= @since AND c.committed_at <= @until
    GROUP BY p.id
    ORDER BY last_commit_at DESC
  `).all({ since, until }).map((row) => ({
    id: row.id,
    name: row.name,
    commitCount: row.commit_count,
    lastCommitAt: row.last_commit_at,
    lastCommitMessage: row.last_commit_message || null
  }));
}

function getProjectCommits(projectId, since, limit) {
  let sql = `
    SELECT sha, message, author, committed_at, url
    FROM commits
    WHERE project_id = @projectId
  `;
  const params = { projectId, limit };

  if (since) {
    sql += ' AND committed_at >= @since';
    params.since = since;
  }

  sql += ' ORDER BY committed_at DESC LIMIT @limit';

  return initDb().prepare(sql).all(params).map((row) => ({
    sha: row.sha,
    message: row.message,
    author: row.author,
    committedAt: row.committed_at,
    url: row.url
  }));
}

function insertCommit({ sha, projectId, message, author, committedAt, url }) {
  const ingestedAt = new Date().toISOString();
  const result = initDb().prepare(`
    INSERT INTO commits (sha, project_id, message, author, committed_at, url, ingested_at)
    VALUES (@sha, @projectId, @message, @author, @committedAt, @url, @ingestedAt)
    ON CONFLICT(sha) DO NOTHING
  `).run({ sha, projectId, message, author, committedAt, url, ingestedAt });

  return result.changes > 0;
}

function insertCommits(commits, projectId) {
  let inserted = 0;
  let skipped = 0;

  const insertAll = initDb().transaction((rows) => {
    for (const commit of rows) {
      if (insertCommit({ ...commit, projectId })) {
        inserted++;
      } else {
        skipped++;
      }
    }
  });

  insertAll(commits);
  return { inserted, skipped };
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDb,
  seedProjectsFromConfig,
  getProjectByRepo,
  getProjectById,
  getMostRecentCommitAt,
  countCommitsInRange,
  listProjectsWithLastCommit,
  getActivityInRange,
  getProjectCommits,
  insertCommit,
  insertCommits,
  closeDb,
  getDataDir,
  getDbPath,
  loadProjectsConfig
};
