const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { logCommitsToNotion } = require('./notion');

dotenv.config();
const app = express();
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Available colors for projects (matching the frontend)
const availableColors = ['🟩', '🟥', '🟪', '🟦', '🟨', '🟧', '🟫', '⬛', '⬜', '🟣', '🟢', '🔴', '🔵', '🟡', '🟠'];

// Function to get least used color for new projects
function getLeastUsedColor(projectColors) {
  const colorUsage = {};
  availableColors.forEach(color => {
    colorUsage[color] = 0;
  });
  
  Object.values(projectColors).forEach(color => {
    if (colorUsage[color] !== undefined) {
      colorUsage[color]++;
    }
  });
  
  let minUsage = Infinity;
  let leastUsedColor = availableColors[0];
  
  availableColors.forEach(color => {
    if (colorUsage[color] < minUsage) {
      minUsage = colorUsage[color];
      leastUsedColor = color;
    }
  });
  
  return leastUsedColor;
}

// Function to assign color to project
function assignColorToProject(projectName, projectColors) {
  if (!projectColors[projectName]) {
    const color = getLeastUsedColor(projectColors);
    projectColors[projectName] = color;
  }
  return projectColors[projectName];
}

// Function to update commit log with new data
async function updateCommitLog(newCommits, repoName) {
  try {
    const commitLogPath = path.join(__dirname, 'public', 'commit-log.json');
    let commitLog = [];
    
    // Read existing commit log if it exists
    if (fs.existsSync(commitLogPath)) {
      const data = fs.readFileSync(commitLogPath, 'utf8');
      commitLog = JSON.parse(data);
    }
    
    // Group new commits by date
    const commitsByDate = {};
    newCommits.forEach(commit => {
      const date = new Date(commit.date).toISOString().split('T')[0];
      if (!commitsByDate[date]) {
        commitsByDate[date] = {};
      }
      if (!commitsByDate[date][repoName]) {
        commitsByDate[date][repoName] = 0;
      }
      commitsByDate[date][repoName]++;
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
    
  } catch (error) {
    console.error('❌ Error updating commit log:', error);
  }
}

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(digest));
}

app.post('/webhook', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const payload = req.body;
  const commits = payload.commits || [];
  const repo = payload.repository.full_name;

  try {
    // Log commits to Notion
    const result = await logCommitsToNotion(commits, repo);
    
    // Also update the commit log for the visualizer
    if (commits.length > 0) {
      await updateCommitLog(commits, repo.split('/').pop());
    }
    
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging to Notion');
  }
});

// Endpoint to fetch data from Notion database
app.get('/api/fetch-notion-data', async (req, res) => {
  try {
    const { Client } = require('@notionhq/client');
    
    // Check if required environment variables are set
    if (!process.env.NOTION_API_KEY) {
      return res.status(400).json({ 
        error: 'NOTION_API_KEY environment variable not set' 
      });
    }
    
    if (!process.env.NOTION_DATABASE_ID) {
      return res.status(400).json({ 
        error: 'NOTION_DATABASE_ID environment variable not set' 
      });
    }
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;
    const since = req.query.since || '2025-01-01';
    
    console.log(`🔄 Fetching commits from Notion database since ${since}...`);
    
    const commitData = {};
    let hasMore = true;
    let startCursor = undefined;
    
    // Fetch all pages from the database
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "Date",
          date: {
            on_or_after: since
          }
        },
        page_size: 100,
        start_cursor: startCursor
      });
      
      // Process each page
      response.results.forEach(page => {
        const projectName = page.properties["Project Name"]?.title?.[0]?.text?.content;
        const date = page.properties["Date"]?.date?.start;
        
        if (projectName && date) {
          const dateKey = date.split('T')[0];
          
          if (!commitData[dateKey]) {
            commitData[dateKey] = {};
          }
          
          if (!commitData[dateKey][projectName]) {
            commitData[dateKey][projectName] = 0;
          }
          
          commitData[dateKey][projectName]++;
        }
      });
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Convert to the expected format
    const commitLog = Object.entries(commitData).map(([date, projects]) => ({
      date,
      projects
    }));
    
    // Sort by date
    commitLog.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Save to file
    const commitLogPath = path.join(__dirname, 'public', 'commit-log.json');
    fs.writeFileSync(commitLogPath, JSON.stringify(commitLog, null, 2));
    
    console.log(`✅ Fetched and saved ${commitLog.length} days of commit data from Notion`);
    
    res.json({ 
      success: true, 
      days: commitLog.length,
      message: `Fetched ${commitLog.length} days of commit data from Notion database`
    });
    
  } catch (error) {
    console.error('❌ Error fetching Notion data:', error);
    res.status(500).json({ 
      error: 'Error fetching Notion data',
      details: error.message 
    });
  }
});

// Serve the commit visualizer page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));
