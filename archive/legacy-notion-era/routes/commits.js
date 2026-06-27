const express = require('express');
const { logCommitsToNotion } = require('../notion');
const { updateCommitLog, authenticateBackfillKey, validateBackfillDate, recordBackfillAttempt } = require('../services/server');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// POST /api/commits - Log commits via API
router.post('/commits', asyncHandler(async (req, res) => {
  try {
    const { commits } = req.body;
    
    if (!commits || !Array.isArray(commits)) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing or invalid commits array' 
      });
    }
    
    console.log(`📝 Logging ${commits.length} commits via API...`);
    
    // Process commits through existing Notion logging system
    const results = [];
    for (const commit of commits) {
      try {
        // Convert API format to webhook format for existing system
        const webhookCommit = {
          id: commit.hash || commit.id,
          message: commit.message,
          timestamp: commit.date,
          author: {
            name: commit.author || 'Unknown'
          },
          url: `https://github.com/${commit.projectId}/commit/${commit.hash || commit.id}`,
          added: commit.additions || 0,
          removed: commit.deletions || 0,
          modified: commit.filesChanged || []
        };
        
        // Use existing Notion logging function
        const result = await logCommitsToNotion([webhookCommit], commit.projectId);
        results.push({
          id: commit.id,
          success: true,
          processed: result.processed,
          skipped: result.skipped
        });
        
      } catch (error) {
        console.error(`❌ Error processing commit ${commit.id}:`, error.message);
        results.push({
          id: commit.id,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`✅ API commit logging completed: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Commits logged successfully`,
      results: results,
      summary: {
        total: commits.length,
        success: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error logging commits via API:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error logging commits',
      details: error.message 
    });
  }
}));

// GET /api/commits/{date} - Get commits for specific date
router.get('/commits/:date', asyncHandler(async (req, res) => {
  try {
    const { date } = req.params;
    const { backfill } = req.query;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }
    
    // Handle backfill request
    if (backfill === 'true') {
      // Authenticate API key
      const auth = authenticateBackfillKey(req);
      if (!auth.authenticated) {
        return res.status(401).json({ 
          success: false,
          error: auth.reason 
        });
      }
      
      // Check rate limits
      const rateLimit = checkBackfillRateLimit(auth.apiKey);
      if (!rateLimit.allowed) {
        return res.status(429).json({ 
          success: false,
          error: rateLimit.reason,
          retryAfter: rateLimit.retryAfter 
        });
      }
      
      // Validate date range
      const dateValidation = validateBackfillDate(date);
      if (!dateValidation.valid) {
        return res.status(400).json({ 
          success: false,
          error: dateValidation.reason 
        });
      }
      
      // Record attempt
      recordBackfillAttempt(auth.apiKey);
      
      console.log(`🔄 Backfill request for ${date} from API key: ${auth.apiKey.substring(0, 8)}...`);
    }
    
    // Read commit log data
    const fs = require('fs');
    const path = require('path');
    const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data'));
    const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');
    
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      try {
        const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
        commitLog = JSON.parse(data);
      } catch (error) {
        console.error('❌ Error reading commit log:', error.message);
      }
    }
    
    // Find commits for the requested date
    const dayData = commitLog.find(day => day.date === date);
    
    if (!dayData) {
      return res.json({
        success: true,
        date: date,
        commits: {},
        totalCommits: 0,
        message: 'No commits found for this date'
      });
    }
    
    // Calculate total commits for the day
    const totalCommits = Object.values(dayData.projects || {}).reduce((sum, count) => sum + count, 0);
    
    res.json({
      success: true,
      date: date,
      commits: dayData.projects || {},
      totalCommits: totalCommits,
      message: `Found ${totalCommits} commits for ${date}`
    });
    
  } catch (error) {
    console.error('❌ Error getting commits for date:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting commits',
      details: error.message 
    });
  }
}));

module.exports = router;