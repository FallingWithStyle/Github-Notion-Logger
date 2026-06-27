const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const timezoneConfig = require('../../scripts/timezone-config');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');

// Function to update commit log with new data
async function updateCommitLog(newCommits, repoName, broadcastEvent) {
  try {
    console.log(`📝 Updating commit log with ${newCommits.length} commits from ${repoName}...`);
    
    const commitLogPath = COMMIT_LOG_PATH;
    let commitLog = [];
    
    // Read existing commit log if it exists
    if (fs.existsSync(commitLogPath)) {
      try {
        const data = fs.readFileSync(commitLogPath, 'utf8');
        commitLog = JSON.parse(data);
        console.log(`📖 Loaded existing commit log with ${commitLog.length} days`);
      } catch (error) {
        console.error('❌ Error reading existing commit log:', error.message);
        // Continue with empty commit log
      }
    }
    
    // Group new commits by date
    const commitsByDate = {};
    newCommits.forEach(commit => {
      // Webhook commits provide `timestamp`; some sources may use `date`
      const rawDate = commit.timestamp || commit.date;
      if (!rawDate) {
        return;
      }
      const parsed = new Date(rawDate);
      if (isNaN(parsed.getTime())) {
        return;
      }
      // Use timezone-aware date calculation with cutoff logic
      const dateKey = timezoneConfig.getEffectiveDate(rawDate);
      if (!commitsByDate[dateKey]) {
        commitsByDate[dateKey] = {};
      }
      // Normalize project name by removing username prefix (e.g., "FallingWithStyle/Audventr" -> "Audventr")
      const normalizedRepoName = repoName.includes('/') ? repoName.split('/').pop() : repoName;
      
      if (!commitsByDate[dateKey][normalizedRepoName]) {
        commitsByDate[dateKey][normalizedRepoName] = 0;
      }
      commitsByDate[dateKey][normalizedRepoName]++;
    });
    
    // Update commit log with new data
    Object.entries(commitsByDate).forEach(([date, projects]) => {
      const existingDayIndex = commitLog.findIndex(day => day.date === date);
      
      if (existingDayIndex >= 0) {
        // Update existing day
        commitLog[existingDayIndex].projects = {
          ...commitLog[existingDayIndex].projects,
          ...projects
        };
      } else {
        // Add new day
        commitLog.push({ date, projects });
      }
    });
    
    // Sort by date
    commitLog.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Write updated commit log
    fs.writeFileSync(commitLogPath, JSON.stringify(commitLog, null, 2));
    console.log(`✅ Updated commit log with ${newCommits.length} new commits from ${repoName}`);
    broadcastEvent('commit-log-updated', { source: 'webhook', updatedDays: Object.keys(commitsByDate).length });
    
  } catch (error) {
    console.error('❌ Error updating commit log:', error);
    throw error; // Re-throw to be handled by caller
  }
}

function verifySignature(req, secret) {
  try {
    const signatureHeader = req.headers['x-hub-signature-256'];
    
    if (!signatureHeader) {
      console.log('❌ No signature provided in request');
      return false;
    }
    
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');
    
    const providedSignature = signatureHeader;
    
    if (expectedSignature !== providedSignature) {
      console.log('❌ Invalid signature');
      console.log('Expected:', expectedSignature);
      console.log('Provided:', providedSignature);
      return false;
    }
    
    console.log('✅ Signature verified');
    return true;
  } catch (error) {
    console.error('❌ Error verifying signature:', error);
    return false;
  }
}

module.exports = {
  updateCommitLog,
  verifySignature
};
