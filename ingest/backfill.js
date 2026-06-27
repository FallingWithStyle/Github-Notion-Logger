#!/usr/bin/env node
// GitHub API → SQLite backfill for config/projects.json repos (G2)

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const {
  initDb,
  seedProjectsFromConfig,
  insertCommits,
  closeDb,
  loadProjectsConfig,
  getProjectById,
  getMostRecentCommitAt,
  countCommitsInRange,
  getDataDir
} = require('../db/store');
const { parseWebhookCommits } = require('./commit-parser');

const DELAY_MS = {
  page: 200,
  repo: 1000
};

function parseArgs(argv) {
  const args = {
    months: 6,
    sinceLast: false,
    projectId: null,
    validate: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--since-last' || arg === '-l') {
      args.sinceLast = true;
    } else if (arg === '--validate' || arg === '-v') {
      args.validate = true;
    } else if (arg === '--project' || arg === '-p') {
      args.projectId = argv[++i];
    } else if (arg === '--months' || arg === '-m') {
      const n = parseInt(argv[++i], 10);
      if (Number.isNaN(n) || n < 1 || n > 72) {
        throw new Error('--months must be between 1 and 72');
      }
      args.months = n;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
GitHub Activity Logger — backfill commits into SQLite

Usage: node ingest/backfill.js [options]

Options:
  -m, --months <n>     Fetch commits from the last N months (default: 6)
  -l, --since-last     Incremental: since newest commit already in SQLite
  -p, --project <id>   Single project id from config/projects.json
  -v, --validate       Spot-check totals vs commit-log.json (UTC; may differ from heatmap TZ)
  -h, --help           Show this help

Requires GITHUB_TOKEN in .env. Repos come from config/projects.json only.

Examples:
  npm run backfill
  npm run backfill -- --since-last
  npm run backfill -- --project devra --months 12
`);
}

function splitRepo(fullName) {
  const slash = fullName.indexOf('/');
  if (slash === -1) {
    throw new Error(`Invalid repo "${fullName}" — expected owner/name`);
  }
  return { owner: fullName.slice(0, slash), name: fullName.slice(slash + 1) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCommitsSince(octokit, owner, name, sinceDate) {
  const commits = [];
  let page = 1;

  while (true) {
    const response = await octokit.repos.listCommits({
      owner,
      repo: name,
      per_page: 100,
      page,
      since: sinceDate.toISOString()
    });

    if (response.data.length === 0) {
      break;
    }

    for (const commit of response.data) {
      commits.push({
        id: commit.sha,
        message: commit.commit.message,
        url: commit.html_url,
        author: { name: commit.commit.author.name },
        timestamp: commit.commit.author.date
      });
    }

    if (response.data.length < 100) {
      break;
    }

    page++;
    await sleep(DELAY_MS.page);
  }

  return commits;
}

function resolveSinceDate(projectId, sinceLast, months) {
  if (sinceLast) {
    const latest = getMostRecentCommitAt(projectId);
    if (latest) {
      // GitHub `since` is inclusive — skip the row we already have
      return new Date(latest.getTime() + 1000);
    }
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - 7);
    return fallback;
  }

  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return since;
}

async function backfillProject(octokit, project, options) {
  const { owner, name } = splitRepo(project.repo);
  const sinceDate = resolveSinceDate(project.id, options.sinceLast, options.months);

  console.log(`\n=== ${project.repo} (since ${sinceDate.toISOString()}) ===`);

  const rawCommits = await fetchCommitsSince(octokit, owner, name, sinceDate);
  const { commits, filtered, total } = parseWebhookCommits(rawCommits);

  if (filtered > 0) {
    console.log(`🔍 Filtered ${filtered} insignificant of ${total} fetched`);
  }

  if (commits.length === 0) {
    console.log('No significant commits to insert');
    return { fetched: rawCommits.length, inserted: 0, skipped: 0, failed: false };
  }

  const { inserted, skipped } = insertCommits(commits, project.id);
  console.log(`💾 ${inserted} inserted, ${skipped} duplicate(s) skipped`);
  return { fetched: rawCommits.length, inserted, skipped, failed: false };
}

function loadCommitLog() {
  const logPath = path.join(getDataDir(), 'commit-log.json');
  if (!fs.existsSync(logPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

// Rough sanity check only — SQLite is filtered; commit-log.json is unfiltered + timezone-bucketed
function validateAgainstCommitLog(projects, months) {
  const commitLog = loadCommitLog();
  if (commitLog.length === 0) {
    console.log('\n⚠️ No commit-log.json — skip validation');
    return;
  }

  const until = new Date().toISOString();
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - months);
  const since = sinceDate.toISOString();

  console.log(`\n=== Spot-check (${since.slice(0, 10)} → ${until.slice(0, 10)}, UTC) ===`);
  console.log('Note: SQLite = significant commits only; commit-log.json = all commits + heatmap TZ. Deltas are expected.');

  for (const project of projects) {
    const sqliteCount = countCommitsInRange(project.id, since, until);
    let jsonCount = 0;

    for (const day of commitLog) {
      const dayDate = new Date(day.date);
      if (dayDate < sinceDate || dayDate > new Date()) {
        continue;
      }
      jsonCount += day.projects?.[project.name] || 0;
    }

    const delta = sqliteCount - jsonCount;
    console.log(`${project.name}: SQLite=${sqliteCount}, commit-log.json≈${jsonCount}, Δ=${delta}`);
  }
}

async function runBackfill(options) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required');
  }

  initDb();
  seedProjectsFromConfig();

  let projects = loadProjectsConfig();
  if (options.projectId) {
    const one = getProjectById(options.projectId);
    if (!one) {
      throw new Error(`Unknown project id "${options.projectId}" — check config/projects.json`);
    }
    projects = [one];
  }

  if (projects.length === 0) {
    console.log('No projects in config/projects.json');
    return { totals: { fetched: 0, inserted: 0, skipped: 0 }, failures: 0, projectCount: 0 };
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const totals = { fetched: 0, inserted: 0, skipped: 0 };
  let failures = 0;

  for (const project of projects) {
    try {
      const result = await backfillProject(octokit, project, options);
      totals.fetched += result.fetched;
      totals.inserted += result.inserted;
      totals.skipped += result.skipped;
    } catch (error) {
      failures++;
      console.error(`❌ ${project.repo}: ${error.message}`);
    }

    if (projects.length > 1) {
      await sleep(DELAY_MS.repo);
    }
  }

  console.log(`\n=== Backfill done ===`);
  console.log(`Fetched: ${totals.fetched}, inserted: ${totals.inserted}, duplicates skipped: ${totals.skipped}`);
  if (failures > 0) {
    console.error(`❌ ${failures} repo(s) failed`);
  }

  if (options.validate) {
    validateAgainstCommitLog(projects, options.months);
  }

  return { totals, failures, projectCount: projects.length };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exit(0);
    }
    runBackfill(options)
      .then((result) => {
        closeDb();
        if (result.failures > 0 && result.totals.fetched === 0) {
          process.exit(1);
        }
      })
      .catch((err) => {
        console.error('Backfill failed:', err.message);
        closeDb();
        process.exit(1);
      });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { runBackfill, fetchCommitsSince };
