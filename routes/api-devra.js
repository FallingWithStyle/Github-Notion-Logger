const express = require('express');
const {
  listProjectsWithLastCommit,
  getActivityInRange,
  getProjectById,
  getProjectCommits
} = require('../db/store');

const router = express.Router();

function requireLoggerAuth(req, res, next) {
  const expected = process.env.GITHUB_LOGGER_TOKEN;
  if (!expected) {
    return next();
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function parseIso8601(value, paramName) {
  if (!value) {
    return { error: `${paramName} is required` };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `Invalid ${paramName}: must be ISO8601` };
  }
  return { date: date.toISOString() };
}

router.use(requireLoggerAuth);

router.get('/projects', (req, res) => {
  res.json({ projects: listProjectsWithLastCommit() });
});

router.get('/activity', (req, res) => {
  const sinceResult = parseIso8601(req.query.since, 'since');
  if (sinceResult.error) {
    return res.status(400).json({ error: sinceResult.error });
  }
  const untilResult = parseIso8601(req.query.until, 'until');
  if (untilResult.error) {
    return res.status(400).json({ error: untilResult.error });
  }

  const since = sinceResult.date;
  const until = untilResult.date;
  if (since > until) {
    return res.status(400).json({ error: 'since must be before until' });
  }

  res.json({
    since,
    until,
    projects: getActivityInRange(since, until)
  });
});

router.get('/projects/:id/commits', (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let since = null;
  if (req.query.since) {
    const sinceResult = parseIso8601(req.query.since, 'since');
    if (sinceResult.error) {
      return res.status(400).json({ error: sinceResult.error });
    }
    since = sinceResult.date;
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);

  res.json({
    projectId: project.id,
    commits: getProjectCommits(project.id, since, limit)
  });
});

module.exports = router;
