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
  insertCommit,
  insertCommits,
  closeDb,
  getDataDir,
  getDbPath,
  loadProjectsConfig
};
