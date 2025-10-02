const express = require('express');
const { logCommitsToNotion } = require('../notion');
const { updateCommitLog, verifySignature } = require('../services/server');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// Webhook endpoint for GitHub commits
router.post('/webhook', asyncHandler(async (req, res) => {
  console.log('🔔 Received webhook request');
  
  // Verify GitHub signature
  if (!verifySignature(req)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const payload = req.body;
    const commits = payload.commits || [];
    const repo = payload.repository.full_name;

    // Acknowledge immediately to avoid GitHub webhook timeouts during cold starts
    res.status(202).json({ accepted: true, commits: commits.length, repo });

    // Process asynchronously after responding
    setImmediate(async () => {
      console.log(`📦 Background processing ${commits.length} commits from ${repo}`);
      try {
        const notionPromise = logCommitsToNotion(commits, repo);
        const notionTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Notion API timeout')), 25000)
        );

        const result = await Promise.race([notionPromise, notionTimeout]);
        console.log(`✅ Notion logging completed: ${result.processed} processed, ${result.skipped} skipped`);

        if (commits.length > 0) {
          const updatePromise = updateCommitLog(commits, repo.split('/').pop());
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
    // If we hit an error before sending the 202 response, send a 500
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error processing webhook',
        message: error.message
      });
    }
  }
}));

module.exports = router;
