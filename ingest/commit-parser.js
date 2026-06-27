// Insignificant-commit filter ported from legacy wanderlog-processor.js

const INSIGNIFICANT_PATTERNS = [
  /^fix typo/i,
  /^typo$/i,
  /^correct typo/i,
  /^fix grammar/i,
  /^grammar fix/i,
  /^spelling/i,
  /^fix spelling/i,
  /^update readme$/i,
  /^readme update$/i,
  /^bump version/i,
  /^version bump/i,
  /^merge branch/i,
  /^revert/i,
  /^wip$/i,
  /^work in progress$/i,
  /^temp$/i,
  /^temporary$/i,
  /^test$/i,
  /^testing$/i,
  /^debug$/i,
  /^console\.log/i,
  /^remove console/i,
  /^cleanup$/i,
  /^format$/i,
  /^lint$/i,
  /^eslint$/i,
  /^prettier$/i
];

const CONVENTIONAL_PREFIX = /^(feat|fix|docs|chore|refactor|test|style|perf|build|ci)(\([^)]+\))?: .+/i;

function isSignificantCommit(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const firstLine = message.trim().split('\n')[0].trim();
  const lower = firstLine.toLowerCase();

  for (const pattern of INSIGNIFICANT_PATTERNS) {
    if (pattern.test(lower)) {
      return false;
    }
  }

  if (CONVENTIONAL_PREFIX.test(firstLine) && firstLine.length >= 8) {
    return true;
  }

  if (firstLine.length < 10) {
    return false;
  }

  return true;
}

function normalizeWebhookCommit(raw) {
  const sha = raw.id || raw.sha;
  const message = (raw.message || '').trim();
  const committedAt = raw.timestamp || raw.committed_at || raw.date;

  if (!sha || !committedAt) {
    return null;
  }

  const authorName = raw.author?.name || raw.committer?.name || 'unknown';

  return {
    sha,
    message,
    author: authorName,
    committedAt: new Date(committedAt).toISOString(),
    url: raw.url || null
  };
}

function parseWebhookCommits(rawCommits) {
  const normalized = (rawCommits || [])
    .map(normalizeWebhookCommit)
    .filter(Boolean);

  const significant = normalized.filter((commit) => isSignificantCommit(commit.message));
  const filtered = normalized.length - significant.length;

  // allCommits: valid normalized rows (heatmap counts all; SQLite uses significant only)
  return { commits: significant, allCommits: normalized, filtered, total: normalized.length };
}

module.exports = {
  isSignificantCommit,
  normalizeWebhookCommit,
  parseWebhookCommits
};
