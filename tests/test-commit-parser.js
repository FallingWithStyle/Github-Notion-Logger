const { parseWebhookCommits, isSignificantCommit } = require('../ingest/commit-parser');

describe('commit-parser', () => {
  const validCommit = (id, message) => ({
    id,
    message,
    timestamp: '2026-06-27T12:00:00Z',
    author: { name: 'Patrick' }
  });

  it('filters insignificant commits for SQLite but keeps them in allCommits for heatmap', () => {
    const { commits, allCommits } = parseWebhookCommits([
      validCommit('a'.repeat(40), 'fix typo'),
      validCommit('b'.repeat(40), 'feat: add sqlite ingest layer')
    ]);

    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe('feat: add sqlite ingest layer');
    expect(allCommits).toHaveLength(2);
  });

  it('drops commits missing sha or timestamp from both arrays', () => {
    const { commits, allCommits } = parseWebhookCommits([
      { message: 'no id', timestamp: '2026-06-27T12:00:00Z' },
      validCommit('c'.repeat(40), 'feat: valid commit row')
    ]);

    expect(allCommits).toHaveLength(1);
    expect(commits).toHaveLength(1);
  });

  it('recognizes common insignificant patterns', () => {
    expect(isSignificantCommit('fix typo')).toBe(false);
    expect(isSignificantCommit('feat: meaningful change here')).toBe(true);
  });
});
