const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { logCommitsToNotion } = require('./notion');

dotenv.config();
const app = express();

// Add request timeout middleware
const timeout = require('connect-timeout');

// Set timeout to 30 seconds for all requests
app.use(timeout('30s'));

// Add error handling for timeout
app.use((req, res, next) => {
  if (!req.timedout) next();
});

app.use(bodyParser.json({ 
  verify: (req, res, buf) => { 
    req.rawBody = buf;
  },
  limit: '10mb' // Limit payload size
}));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path} - Started`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📤 ${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Serve static files from public directory
// Provide dynamic commit log before static so it overrides bundled files
// Configure persistent data directory (Fly.io volume at /data when mounted)
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');

// Simple Server-Sent Events (SSE) hub to notify clients when data updates
const sseClients = new Set();

function broadcastEvent(eventName, payload) {
  const dataString = JSON.stringify(payload || {});
  for (const client of sseClients) {
    try {
      client.write(`event: ${eventName}\n`);
      client.write(`data: ${dataString}\n\n`);
    } catch (e) {
      // Best-effort; connection might be closed
    }
  }
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  // Heartbeat to keep connection alive behind proxies
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);

  sseClients.add(res);
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Serve the most recent commit log from persistent storage
app.get('/commit-log.json', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
      return res.type('application/json').send(data);
    }
    return res.json([]);
  } catch (error) {
    console.error('❌ Error reading commit log:', error.message);
    return res.json([]);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Validate required environment variables
const requiredEnvVars = ['NOTION_API_KEY', 'NOTION_DATABASE_ID', 'GITHUB_WEBHOOK_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please set the following environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
  process.exit(1);
}

console.log('✅ All required environment variables are set');

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
      const dateKey = parsed.toISOString().split('T')[0];
      if (!commitsByDate[dateKey]) {
        commitsByDate[dateKey] = {};
      }
      if (!commitsByDate[dateKey][repoName]) {
        commitsByDate[dateKey][repoName] = 0;
      }
      commitsByDate[dateKey][repoName]++;
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

function verifySignature(req) {
  try {
    const signatureHeader = req.headers['x-hub-signature-256'];
    
    if (!signatureHeader) {
      console.log('❌ No signature provided in request');
      return false;
    }
    
    if (!SECRET) {
      console.log('❌ No webhook secret configured');
      return false;
    }
    
    // Normalize header and compute digest
    const received = String(signatureHeader).trim();
    if (!received.toLowerCase().startsWith('sha256=')) {
      console.log('❌ Signature header missing sha256= prefix');
      return false;
    }
    const receivedHex = received.slice('sha256='.length).toLowerCase();

    const hmac = crypto.createHmac('sha256', SECRET);
    const computedHex = hmac.update(req.rawBody).digest('hex');

    // Compare bytes in constant time
    const receivedBytes = Buffer.from(receivedHex, 'hex');
    const computedBytes = Buffer.from(computedHex, 'hex');
    if (receivedBytes.length !== computedBytes.length) {
      console.log('❌ Invalid signature length (bytes)', {
        receivedBytes: receivedBytes.length,
        computedBytes: computedBytes.length,
      });
      console.log('🔍 Sig debug (prefixes only):', {
        receivedPrefix: 'sha256=' + receivedHex.slice(0, 5),
        computedPrefix: 'sha256=' + computedHex.slice(0, 5),
      });
      return false;
    }

    const isValid = crypto.timingSafeEqual(receivedBytes, computedBytes);
    if (!isValid) {
      console.log('❌ Invalid signature provided');
      console.log('🔍 Sig debug (prefixes only):', {
        receivedPrefix: 'sha256=' + receivedHex.slice(0, 5),
        computedPrefix: 'sha256=' + computedHex.slice(0, 5),
      });
    }
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying signature:', error.message);
    return false;
  }
}

// Add error handling wrapper for async routes
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.post('/webhook', asyncHandler(async (req, res) => {
  console.log('🔔 Received webhook request');

  try {
    // Verify signature
    if (!verifySignature(req)) {
      console.log('❌ Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Webhook signature verified');

    const payload = req.body;

    // Validate payload structure
    if (!payload) {
      console.log('❌ No payload received');
      return res.status(400).json({ error: 'No payload received' });
    }

    if (!payload.repository || !payload.repository.full_name) {
      console.log('❌ Invalid payload: missing repository information');
      return res.status(400).json({ error: 'Invalid payload: missing repository information' });
    }

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

// Endpoint to fetch data from Notion database
app.get('/api/fetch-notion-data', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Starting Notion data fetch...');
    
    const { Client } = require('@notionhq/client');
    
    // Check if required environment variables are set
    if (!process.env.NOTION_API_KEY) {
      console.log('❌ NOTION_API_KEY not set');
      return res.status(400).json({ 
        error: 'NOTION_API_KEY environment variable not set' 
      });
    }
    
    if (!process.env.NOTION_DATABASE_ID) {
      console.log('❌ NOTION_DATABASE_ID not set');
      return res.status(400).json({ 
        error: 'NOTION_DATABASE_ID environment variable not set' 
      });
    }
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;

    // Support incremental mode: merge new range into existing commit log
    const isIncremental = req.query.incremental === 'true' || req.query.incremental === '1';
    const overlapDays = Math.max(0, parseInt(req.query.overlapDays || '1', 10) || 0);

    let since = req.query.since || '2025-01-01';
    let existingCommitLog = [];

    if (isIncremental) {
      try {
        if (fs.existsSync(COMMIT_LOG_PATH)) {
          const existing = JSON.parse(fs.readFileSync(COMMIT_LOG_PATH, 'utf8'));
          if (Array.isArray(existing) && existing.length > 0) {
            existingCommitLog = existing;
            const lastDateStr = existing[existing.length - 1]?.date;
            if (lastDateStr) {
              const last = new Date(lastDateStr);
              if (!isNaN(last.getTime())) {
                // Start a bit earlier to bridge any timezone/out-of-order commits
                last.setDate(last.getDate() - overlapDays);
                since = last.toISOString().split('T')[0];
              }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not load existing commit log for incremental merge:', e.message);
      }
    }
    
    console.log(`🔄 Fetching commits from Notion database since ${since}...`);
    
    const commitData = {};
    let hasMore = true;
    let startCursor = undefined;
    let pageCount = 0;
    
    // Fetch all pages from the database with timeout
    const fetchTimeout = setTimeout(() => {
      console.log('❌ Notion fetch timeout');
      throw new Error('Notion fetch timeout');
    }, 60000); // 60 second timeout
    
    try {
      while (hasMore) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount}...`);
        
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
      
      clearTimeout(fetchTimeout);
      
      // Convert to the expected format
      const fetchedLog = Object.entries(commitData).map(([date, projects]) => ({
        date,
        projects
      }));

      // Sort by date
      fetchedLog.sort((a, b) => new Date(a.date) - new Date(b.date));

      let finalLog = fetchedLog;

      if (isIncremental && existingCommitLog.length > 0) {
        // Merge: index existing by date
        const byDate = new Map(existingCommitLog.map(d => [d.date, { ...d }]));
        for (const day of fetchedLog) {
          const existing = byDate.get(day.date);
          if (existing) {
            // Merge project counts (add or overwrite with fetched values)
            byDate.set(day.date, {
              date: day.date,
              projects: {
                ...existing.projects,
                ...day.projects,
              }
            });
          } else {
            byDate.set(day.date, { ...day });
          }
        }
        finalLog = Array.from(byDate.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      // Save to file
      fs.writeFileSync(COMMIT_LOG_PATH, JSON.stringify(finalLog, null, 2));

      console.log(`✅ Fetched and saved ${fetchedLog.length} days from Notion (${isIncremental ? 'merged' : 'full overwrite'})`);

      // Notify clients to refresh
      broadcastEvent('commit-log-updated', { source: 'notion', fetchedDays: fetchedLog.length, incremental: isIncremental });

      res.json({ 
        success: true, 
        days: finalLog.length,
        message: `Fetched ${fetchedLog.length} day(s) from Notion (${isIncremental ? 'merged' : 'full'})`
      });
      
    } catch (error) {
      clearTimeout(fetchTimeout);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fetching Notion data:', error);
    res.status(500).json({ 
      error: 'Error fetching Notion data',
      details: error.message 
    });
  }
}));

// Serve the commit visualizer page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Handle 404 errors
app.use((req, res) => {
  console.log(`❌ 404 - ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Webhook secret configured: ${SECRET ? 'Yes' : 'No'}`);
  console.log(`📝 Notion API key configured: ${process.env.NOTION_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🗄️ Notion database ID configured: ${process.env.NOTION_DATABASE_ID ? 'Yes' : 'No'}`);
});

// Add server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds
