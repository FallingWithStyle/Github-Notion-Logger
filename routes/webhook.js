const express = require('express');
const { updateCommitLog, verifySignature, asyncHandler } = require('../services/server');
const { getProjectByRepo, insertCommits } = require('../db/store');
const { parseWebhookCommits } = require('../ingest/commit-parser');

const router = express.Router();
const NOTION_SYNC = process.env.NOTION_SYNC === 'true';

function getNotionLogger() {
  if (!NOTION_SYNC) return null;
  return require('../archive/legacy-notion-era/notion');
}

router.post('/webhook', asyncHandler(async (req, res) => {
  console.log('🔔 Received webhook request');

  if (!verifySignature(req)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const payload = req.body;
    if (!payload?.repository?.full_name) {
      console.warn('⚠️ Webhook missing repository.full_name — ignoring');
      return res.status(400).json({ error: 'Missing repository in payload' });
    }

    const rawCommits = payload.commits || [];
    const repo = payload.repository.full_name;

    res.status(202).json({ accepted: true, commits: rawCommits.length, repo });

    setImmediate(async () => {
      console.log(`📦 Background processing ${rawCommits.length} commits from ${repo}`);
      try {
        const project = getProjectByRepo(repo);
        if (!project) {
          console.warn(`⚠️ Unknown repo "${repo}" — add to config/projects.json to ingest commits`);
          return;
        }

        const { commits, allCommits, filtered, total } = parseWebhookCommits(rawCommits);
        if (filtered > 0) {
          console.log(`🔍 Filtered ${filtered} insignificant commit(s) from ${total} normalized (SQLite only)`);
        }

        if (commits.length > 0) {
          const { inserted, skipped } = insertCommits(commits, project.id);
          console.log(`💾 SQLite: ${inserted} inserted, ${skipped} duplicate(s) skipped for ${project.id}`);
        }

        if (NOTION_SYNC) {
          const notion = getNotionLogger();
          const notionPromise = notion.logCommitsToNotion(rawCommits, repo);
          const notionTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Notion API timeout')), 25000)
          );
          const result = await Promise.race([notionPromise, notionTimeout]);
          console.log(`✅ Notion logging completed: ${result.processed} processed, ${result.skipped} skipped`);
        }

        // Legacy frozen heatmap — all valid commits, unfiltered (pre-G1 behavior)
        if (allCommits.length > 0) {
          const heatmapCommits = allCommits.map((c) => ({
            id: c.sha,
            message: c.message,
            timestamp: c.committedAt,
            url: c.url
          }));
          const updatePromise = updateCommitLog(heatmapCommits, project.name);
          const updateTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Commit log update timeout')), 10000)
          );
          await Promise.race([updatePromise, updateTimeout]);
        }

        console.log('✅ Webhook background processing completed successfully');
      } catch (error) {
        console.error('❌ Error in webhook background processing:', error);
      }
    });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error processing webhook',
        message: error.message
      });
    }
  }
}));

module.exports = router;
