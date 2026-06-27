const express = require('express');
const { updateCommitLog, verifySignature, asyncHandler } = require('../services/server');

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
    const commits = payload.commits || [];
    const repo = payload.repository.full_name;

    res.status(202).json({ accepted: true, commits: commits.length, repo });

    setImmediate(async () => {
      console.log(`📦 Background processing ${commits.length} commits from ${repo}`);
      try {
        if (NOTION_SYNC) {
          const notion = getNotionLogger();
          const notionPromise = notion.logCommitsToNotion(commits, repo);
          const notionTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Notion API timeout')), 25000)
          );
          const result = await Promise.race([notionPromise, notionTimeout]);
          console.log(`✅ Notion logging completed: ${result.processed} processed, ${result.skipped} skipped`);
        }

        if (commits.length > 0) {
          const repoName = repo.split('/').pop();
          const updatePromise = updateCommitLog(commits, repoName);
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
