const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { logCommitsToNotion, addWeeklyPlanningEntry, addOrUpdateWeeklyPlanningEntry, getWeeklyPlanningData, updateWeeklyPlanningEntry, cleanupDuplicateEntries } = require('./notion');
const timezoneConfig = require('./timezone-config');
const { assignColor, getProjectColor, updateProjectColor, migrateExistingProjects, getColorStats, hexToHsl, generatePaletteFromHue } = require('./color-palette');
const { Client } = require('@notionhq/client');
const { scheduleDailyProcessing, runManualProcessing } = require('./wanderlog-processor');

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

// Add CORS support for external API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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

// Note: Static file serving moved to after API routes to prevent conflicts

const PORT = process.env.PORT || 8080;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Validate required environment variables
const requiredEnvVars = ['NOTION_API_KEY', 'NOTION_COMMIT_FROM_GITHUB_LOG_ID', 'GITHUB_WEBHOOK_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please set the following environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
  process.exit(1);
}

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

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
      // Use timezone-aware date calculation with cutoff logic
      const dateKey = timezoneConfig.getEffectiveDate(rawDate);
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
    
    if (!process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID) {
      console.log('❌ NOTION_COMMIT_FROM_GITHUB_LOG_ID not set');
      return res.status(400).json({ 
        error: 'NOTION_COMMIT_FROM_GITHUB_LOG_ID environment variable not set' 
      });
    }
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;

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
                since = last.toISOString().split('T')[0]; // Use UTC date for consistency
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
            // The date from Notion is already processed with timezone logic
            // Just extract the date portion (YYYY-MM-DD) for grouping
            const dateObj = new Date(date);
            const dateKey = dateObj.toISOString().split('T')[0];
            
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

// Serve static files from public directory (after API routes)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the commit visualizer page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the weekly planning page
app.get('/week', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'week.html'));
});

// Serve the projects page
app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'projects.html'));
});

// Serve the progress dashboard page
app.get('/progress', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'progress.html'));
});

// API endpoint to get 28-day project data for weekly planning
app.get('/api/weekly-data', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching 28-day data for weekly planning...');
    
    // Read existing commit log
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      try {
        const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
        commitLog = JSON.parse(data);
      } catch (error) {
        console.error('❌ Error reading commit log:', error.message);
        return res.status(500).json({ error: 'Failed to read commit log' });
      }
    }
    
    // Calculate date range (28 days ago from today)
    const today = new Date();
    const twentyEightDaysAgo = new Date(today);
    twentyEightDaysAgo.setDate(today.getDate() - 28);
    const startDate = twentyEightDaysAgo.toISOString().split('T')[0]; // Use UTC date for consistency
    
    // Filter data to last 28 days
    const recentData = commitLog.filter(day => day.date >= startDate);
    
    // Aggregate data by project
    const projectData = {};
    const projectColors = {};
    
    recentData.forEach(day => {
      Object.entries(day.projects).forEach(([projectName, commitCount]) => {
        if (!projectData[projectName]) {
          projectData[projectName] = {
            name: projectName,
            totalCommits: 0,
            activityDates: [],
            lastActivity: null,
            category: null
          };
        }
        
        projectData[projectName].totalCommits += commitCount;
        projectData[projectName].activityDates.push(day.date);
        
        const activityDate = new Date(day.date);
        if (!projectData[projectName].lastActivity || activityDate > new Date(projectData[projectName].lastActivity)) {
          projectData[projectName].lastActivity = day.date;
        }
      });
    });
    
    // Load category data from weekly planning data
    try {
      const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
      if (fs.existsSync(weeklyPlansPath)) {
        const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
        const weeklyPlans = JSON.parse(weeklyPlansData);
        
        // Get the most recent weekly plan
        if (weeklyPlans.length > 0) {
          const latestPlan = weeklyPlans[weeklyPlans.length - 1];
          const userAnswers = latestPlan.planData?.userAnswers || {};
          
          // Apply categories to projects
          Object.values(projectData).forEach(project => {
            const savedProject = userAnswers[project.name];
            if (savedProject && savedProject.category) {
              project.category = savedProject.category;
              console.log(`📝 Applied category "${savedProject.category}" to ${project.name}`);
            }
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load category data from weekly plans:', error.message);
    }
    
    // Migrate existing projects to color system and assign colors
    const projectArray = Object.values(projectData);
    const migratedProjects = migrateExistingProjects(projectArray);
    
    // Update projectData with migrated projects
    migratedProjects.forEach(project => {
      projectData[project.name] = project;
    });
    
    // Also ensure all projects in the color palette system have correct categories
    // This handles projects that might not be in the current 28-day window
    const { getAllProjectColors } = require('./color-palette');
    const allProjectColors = getAllProjectColors();
    
    Object.entries(allProjectColors).forEach(([projectName, colorData]) => {
      if (colorData.category && !projectData[projectName]) {
        // This project exists in color palette but not in current weekly data
        // Create a minimal project entry to ensure it gets the right category
        projectData[projectName] = {
          name: projectName,
          category: colorData.category,
          status: 'unknown',
          priorityScore: 0,
          basePriorityScore: 0,
          lastActivity: null
        };
      }
    });
    
    // Get project colors for response - use the color palette system directly
    const projectColorMap = getAllProjectColors();
    
    // Also ensure projectData has color information
    Object.values(projectData).forEach(project => {
      if (projectColorMap[project.name]) {
        project.color = projectColorMap[project.name];
      }
    });
    
    // Get unique categories from existing data (if any)
    const categories = new Set();
    Object.values(projectData).forEach(project => {
      if (project.category) {
        categories.add(project.category);
      }
    });
    
    res.json({
      success: true,
      projects: Object.values(projectData),
      projectColors: projectColorMap,
      categories: Array.from(categories),
      dateRange: {
        start: startDate,
        end: today.toISOString().split('T')[0] // Use UTC date for consistency
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly data:', error);
    res.status(500).json({ 
      error: 'Error fetching weekly data',
      details: error.message 
    });
  }
}));

// API endpoint to save weekly plan
app.post('/api/weekly-plan', asyncHandler(async (req, res) => {
  try {
    const { planData, weekStart } = req.body;
    
    if (!planData || !weekStart) {
      return res.status(400).json({ error: 'Missing plan data or week start date' });
    }
    
    const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
    let weeklyPlans = [];
    
    // Read existing weekly plans
    if (fs.existsSync(weeklyPlansPath)) {
      try {
        const data = fs.readFileSync(weeklyPlansPath, 'utf8');
        weeklyPlans = JSON.parse(data);
      } catch (error) {
        console.warn('⚠️ Could not read existing weekly plans, starting fresh');
      }
    }
    
    // Migrate old 3-1-5 scale data to new 2-1-5 scale if needed
    const migratedPlanData = {
      ...planData,
      userAnswers: migrateOldUserAnswers(planData.userAnswers)
    };
    
    // Ensure projects have colors assigned
    if (migratedPlanData.projects) {
      migratedPlanData.projects = migrateExistingProjects(migratedPlanData.projects);
    }
    
    // Add new plan
    const newPlan = {
      id: Date.now().toString(),
      weekStart,
      createdAt: new Date().toISOString(),
      planData: migratedPlanData
    };
    
    weeklyPlans.push(newPlan);
    
    // Write updated plans
    fs.writeFileSync(weeklyPlansPath, JSON.stringify(weeklyPlans, null, 2));
    
    console.log(`✅ Saved weekly plan for week starting ${weekStart}`);
    
    res.json({
      success: true,
      planId: newPlan.id,
      message: 'Weekly plan saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving weekly plan:', error);
    res.status(500).json({ 
      error: 'Error saving weekly plan',
      details: error.message 
    });
  }
}));

// API endpoint to get weekly plans
app.get('/api/weekly-plans', asyncHandler(async (req, res) => {
  try {
    const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
    let weeklyPlans = [];
    
    if (fs.existsSync(weeklyPlansPath)) {
      try {
        const data = fs.readFileSync(weeklyPlansPath, 'utf8');
        weeklyPlans = JSON.parse(data);
      } catch (error) {
        console.warn('⚠️ Could not read weekly plans:', error.message);
      }
    }
    
    // Migrate old data to new format before returning
    const migratedPlans = weeklyPlans.map(plan => ({
      ...plan,
      planData: {
        ...plan.planData,
        userAnswers: migrateOldUserAnswers(plan.planData.userAnswers)
      }
    }));
    
    res.json({
      success: true,
      plans: migratedPlans
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly plans:', error);
    res.status(500).json({ 
      error: 'Error fetching weekly plans',
      details: error.message 
    });
  }
}));

// API endpoint to sync weekly plan to Notion
app.post('/api/weekly-plan/sync-notion', asyncHandler(async (req, res) => {
  try {
    const { planData, weekStart } = req.body;
    
    if (!planData || !weekStart) {
      return res.status(400).json({ error: 'Missing plan data or week start date' });
    }
    
    console.log(`🔄 Syncing weekly plan to Notion for week starting ${weekStart}...`);
    
    const syncResults = [];
    const { projects, userAnswers, categories } = planData;
    
    // Migrate old 3-1-5 scale data to new 2-1-5 scale if needed
    const migratedUserAnswers = migrateOldUserAnswers(userAnswers);
    
    // Sync each project's planning data to Notion
    for (const project of projects) {
      const answers = migratedUserAnswers[project.name] || {};
      
      console.log(`🔄 Processing project: ${project.name}`);
      console.log(`   - Head rating: ${answers.head}`);
      console.log(`   - Heart rating: ${answers.heart}`);
      console.log(`   - Category: ${project.category}`);
      console.log(`   - Status: ${project.status}`);
      
      if (answers.head || answers.heart) {
        try {
          const notionEntry = await addOrUpdateWeeklyPlanningEntry({
            projectName: project.name,
            weekStart,
            head: answers.head,
            heart: answers.heart,
            category: project.category,
            status: project.status,
            weeklyFocus: planData.weeklyFocus || '',
            notes: `Weekly planning data for ${project.name}`
          });
          
          syncResults.push({
            project: project.name,
            status: 'success',
            notionId: notionEntry.id
          });
          
        } catch (error) {
          console.error(`❌ Failed to sync ${project.name} to Notion:`, error.message);
          syncResults.push({
            project: project.name,
            status: 'error',
            error: error.message
          });
        }
      }
    }
    
    const successCount = syncResults.filter(r => r.status === 'success').length;
    const errorCount = syncResults.filter(r => r.status === 'error').length;
    
    console.log(`✅ Synced ${successCount} projects to Notion (${errorCount} errors)`);
    
    // Clean up any duplicate entries for this week
    try {
      const duplicatesRemoved = await cleanupDuplicateEntries(weekStart);
      if (duplicatesRemoved > 0) {
        console.log(`🧹 Cleaned up ${duplicatesRemoved} duplicate entries`);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up duplicates:', cleanupError.message);
    }
    
    res.json({
      success: true,
      message: `Synced ${successCount} projects to Notion`,
      results: syncResults,
      summary: {
        total: projects.length,
        success: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error syncing weekly plan to Notion:', error);
    res.status(500).json({ 
      error: 'Error syncing to Notion',
      details: error.message 
    });
  }
}));

// Migrate old 3-1-5 scale user answers to new 2-1-5 scale
function migrateOldUserAnswers(userAnswers) {
  const migrated = {};
  
  Object.entries(userAnswers).forEach(([projectName, answers]) => {
    migrated[projectName] = { ...answers };
    
    // If old 3-1-5 scale properties exist, migrate them to new 2-1-5 scale
    if (answers.working && !answers.head) {
      // Convert "working" (3-1-5) to "head" (2-1-5)
      // Map: 3→2, 1→1, 5→5 (same scale, different property name)
      migrated[projectName].head = answers.working;
      console.log(`🔄 Migrated ${projectName}: working(${answers.working}) → head(${answers.working})`);
    }
    
    if (answers.improve && !answers.heart) {
      // Convert "improve" (3-1-5) to "heart" (2-1-5)
      // Map: 3→2, 1→1, 5→5 (same scale, different property name)
      migrated[projectName].heart = answers.improve;
      console.log(`🔄 Migrated ${projectName}: improve(${answers.improve}) → heart(${answers.improve})`);
    }
    
    // Note: "start" property from old 3-1-5 scale is not used in new 2-1-5 scale
    // It was about what to start next, which is now covered by the status field
  });
  
  return migrated;
}

// API endpoint to get weekly planning data from Notion
app.get('/api/weekly-plan/notion', asyncHandler(async (req, res) => {
  try {
    const { weekStart } = req.query;
    
    console.log(`📊 Fetching weekly planning data from Notion${weekStart ? ` for week ${weekStart}` : ''}...`);
    
    const notionData = await getWeeklyPlanningData(weekStart);
    
    res.json({
      success: true,
      data: notionData,
      count: notionData.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly planning data from Notion:', error);
    res.status(500).json({ 
      error: 'Error fetching from Notion',
      details: error.message 
    });
  }
}));

// Timezone configuration endpoints
app.get('/api/timezone-config', (req, res) => {
  try {
    const config = timezoneConfig.getConfig();
    const timezoneInfo = timezoneConfig.getTimezoneInfo();
    const availableTimezones = timezoneConfig.getAvailableTimezones();
    
    res.json({
      success: true,
      config,
      timezoneInfo,
      availableTimezones
    });
  } catch (error) {
    console.error('❌ Error getting timezone config:', error);
    res.status(500).json({ 
      error: 'Error getting timezone configuration',
      details: error.message 
    });
  }
});

app.post('/api/timezone-config', (req, res) => {
  try {
    const { timezone, cutoffHour, cutoffMinute } = req.body;
    
    if (timezone && !timezoneConfig.getAvailableTimezones().find(tz => tz.value === timezone)) {
      return res.status(400).json({ error: 'Invalid timezone' });
    }
    
    if (cutoffHour !== undefined && (cutoffHour < 0 || cutoffHour > 23)) {
      return res.status(400).json({ error: 'Cutoff hour must be between 0 and 23' });
    }
    
    if (cutoffMinute !== undefined && (cutoffMinute < 0 || cutoffMinute > 59)) {
      return res.status(400).json({ error: 'Cutoff minute must be between 0 and 59' });
    }
    
    const updateData = {};
    if (timezone !== undefined) updateData.timezone = timezone;
    if (cutoffHour !== undefined) updateData.cutoffHour = parseInt(cutoffHour);
    if (cutoffMinute !== undefined) updateData.cutoffMinute = parseInt(cutoffMinute);
    
    const success = timezoneConfig.updateConfig(updateData);
    
    if (success) {
      res.json({
        success: true,
        message: 'Timezone configuration updated',
        config: timezoneConfig.getConfig()
      });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  } catch (error) {
    console.error('❌ Error updating timezone config:', error);
    res.status(500).json({ 
      error: 'Error updating timezone configuration',
      details: error.message 
    });
  }
});

// PRD Story Tracking endpoints
app.get('/api/prd-stories', asyncHandler(async (req, res) => {
  try {
    const { projectName, status } = req.query;
    
    console.log(`📊 Fetching PRD stories${projectName ? ` for project ${projectName}` : ''}${status ? ` with status ${status}` : ''}...`);
    
    const { getPrdStoryData } = require('./notion');
    const allStories = await getPrdStoryData(projectName, status);
    
    // Filter to only use the latest PRD version for each project
    const latestProjectVersions = new Map();
    const filteredStories = [];
    
    // Group stories by base project name (without version info)
    allStories.forEach(story => {
      const baseProjectName = story.projectName.replace(/\s+v?\d+(\.\d+)?\s*$/i, '').trim();
      const storyDate = new Date(story.created || story.lastUpdated);
      
      if (!latestProjectVersions.has(baseProjectName) || 
          storyDate > latestProjectVersions.get(baseProjectName).date) {
        latestProjectVersions.set(baseProjectName, {
          projectName: story.projectName,
          date: storyDate
        });
      }
    });
    
    // Filter stories to only include those from the latest PRD version
    allStories.forEach(story => {
      const baseProjectName = story.projectName.replace(/\s+v?\d+(\.\d+)?\s*$/i, '').trim();
      const latestVersion = latestProjectVersions.get(baseProjectName);
      
      if (latestVersion && story.projectName === latestVersion.projectName) {
        filteredStories.push(story);
      }
    });
    
    console.log(`📊 Filtered to latest PRD versions: ${filteredStories.length} stories (from ${allStories.length} total)`);
    
    // Deduplicate stories based on title and project
    const seenStories = new Map();
    const deduplicatedStories = [];
    
    for (const story of filteredStories) {
      // Skip stories with null/empty titles
      if (!story.storyTitle || story.storyTitle.trim() === '') {
        continue;
      }
      
      // Create a key for deduplication
      const key = `${story.projectName || 'Unknown'}-${story.storyTitle.toLowerCase().trim()}`;
      
      if (!seenStories.has(key)) {
        seenStories.set(key, true);
        deduplicatedStories.push(story);
      }
    }
    
    // Load project categories and status from weekly planning data
    const projectMetadata = {};
    try {
      const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
      if (fs.existsSync(weeklyPlansPath)) {
        const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
        const weeklyPlans = JSON.parse(weeklyPlansData);
        
        // Get the most recent weekly plan
        if (weeklyPlans.length > 0) {
          const latestPlan = weeklyPlans[weeklyPlans.length - 1];
          const userAnswers = latestPlan.planData?.userAnswers || {};
          
          // Build project metadata map
          Object.entries(userAnswers).forEach(([projectName, projectData]) => {
            if (projectData.category || projectData.status) {
              projectMetadata[projectName] = {
                category: projectData.category || 'Unknown Category',
                status: projectData.status || 'unknown'
              };
            }
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load project metadata from weekly plans:', error.message);
    }
    
    // Add project metadata to stories
    deduplicatedStories.forEach(story => {
      const projectName = story.projectName || 'Unknown';
      let metadata = projectMetadata[projectName];
      
      // If no direct match, try to find a match by extracting the base project name
      if (!metadata) {
        // Try to extract base project name from PRD titles
        const baseName = projectName.replace(/\s+Product\s+Requirements\s+Document\s+\(PRD\)\s*v?\d*$/i, '').trim();
        metadata = projectMetadata[baseName];
      }
      
      if (metadata) {
        story.projectCategory = metadata.category;
        story.projectStatus = metadata.status;
      } else {
        story.projectCategory = 'Unknown Category';
        story.projectStatus = 'unknown';
      }
    });
    
    // Sort stories by project, then by status, then by priority
    deduplicatedStories.sort((a, b) => {
      // First by project name
      const projectA = a.projectName || 'Unknown';
      const projectB = b.projectName || 'Unknown';
      if (projectA !== projectB) {
        return projectA.localeCompare(projectB);
      }
      
      // Then by status (Active > Planning > Review > Idea > Done)
      const statusOrder = { 'Active': 1, 'Planning': 2, 'Review': 3, 'Idea': 4, 'Done': 5 };
      const statusA = statusOrder[a.status] || 6;
      const statusB = statusOrder[b.status] || 6;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Finally by priority (higher first)
      const priorityA = a.priority || 3;
      const priorityB = b.priority || 3;
      return priorityB - priorityA;
    });
    
    res.json({
      success: true,
      data: deduplicatedStories,
      count: deduplicatedStories.length,
      originalCount: allStories.length,
      filteredCount: filteredStories.length,
      duplicatesRemoved: filteredStories.length - deduplicatedStories.length,
      archivedVersionsRemoved: allStories.length - filteredStories.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching PRD stories:', error);
    res.status(500).json({ 
      error: 'Error fetching PRD stories',
      details: error.message 
    });
  }
}));

// Cache for project progress data
const progressCache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// New optimized PRD and task-list processing endpoints
app.get('/api/project-progress', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.query;
    
    console.log(`📊 Fetching project progress${repository ? ` for ${repository}` : ' for all repositories'}...`);
    
    // Check cache first
    const cacheKey = repository || 'all';
    const cached = progressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
      console.log(`📈 Returning cached progress data for ${cacheKey}`);
      return res.json({
        success: true,
        data: cached.data,
        count: cached.data.length,
        cached: true
      });
    }
    
    const PrdTaskProcessor = require('./prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    let results;
    if (repository) {
      // Process single repository
      const result = await processor.processRepository(repository);
      results = [result];
    } else {
      // For all repositories, use a timeout and return partial results if needed
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), 25000)
      );
      
      try {
        const processPromise = processor.processAllRepositories();
        results = await Promise.race([processPromise, timeoutPromise]);
      } catch (timeoutError) {
        if (timeoutError.message === 'Processing timeout') {
          console.warn('⚠️ Processing timeout, returning empty results');
          results = [];
        } else {
          throw timeoutError;
        }
      }
    }
    
    // Cache the results
    progressCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      data: results,
      count: results.length,
      cached: false
    });
  } catch (error) {
    console.error('❌ Error fetching project progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project progress',
      details: error.message 
    });
  }
}));

// Get project progress with detailed breakdown
app.get('/api/project-progress/:repository', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.params;
    
    console.log(`📊 Fetching detailed progress for ${repository}...`);
    
    // Check cache first
    const cacheKey = `detail:${repository}`;
    const cached = progressCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
      console.log(`📈 Returning cached detailed progress for ${repository}`);
      return res.json({
        success: true,
        data: cached.data,
        cached: true
      });
    }
    
    const PrdTaskProcessor = require('./prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    const result = await processor.processRepository(repository);
    
    if (result.error) {
      return res.status(404).json({
        success: false,
        error: 'Repository not found or error processing',
        details: result.error
      });
    }
    
    // Cache the result
    progressCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      data: result,
      cached: false
    });
  } catch (error) {
    console.error('❌ Error fetching detailed progress:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch detailed progress',
      details: error.message 
    });
  }
}));

// Clear progress cache
app.post('/api/project-progress/clear-cache', asyncHandler(async (req, res) => {
  try {
    progressCache.clear();
    console.log('🗑️ Progress cache cleared');
    
    res.json({
      success: true,
      message: 'Progress cache cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing progress cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear progress cache',
      details: error.message 
    });
  }
}));

// Clear scan cache
app.post('/api/prd-stories/clear-cache', asyncHandler(async (req, res) => {
  try {
    const PrdTaskProcessor = require('./prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    const clearedCount = await processor.clearCache();
    console.log(`🗑️ Scan cache cleared: ${clearedCount} entries`);
    
    res.json({
      success: true,
      message: `Scan cache cleared successfully (${clearedCount} entries removed)`,
      clearedCount
    });
  } catch (error) {
    console.error('❌ Error clearing scan cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear scan cache',
      details: error.message 
    });
  }
}));

// Get repositories list (simple, no file processing)
app.get('/api/prd-stories/repositories', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Getting repositories list...');
    
    const PrdTaskProcessor = require('./prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    // Just get the repository list without processing files
    const repos = await processor.getAllRepositories();
    
    // Get ignored repositories
    const ignoredPath = path.join(__dirname, 'data', 'ignored-repos.json');
    let ignoredRepos = [];
    
    if (fs.existsSync(ignoredPath)) {
      try {
        const data = fs.readFileSync(ignoredPath, 'utf8');
        ignoredRepos = JSON.parse(data);
      } catch (error) {
        console.warn('⚠️ Error reading ignored repos file:', error.message);
      }
    }
    
    const ignoredNames = new Set(ignoredRepos.map(repo => repo.name));
    
    // Filter out ignored repositories
    const filteredRepos = repos.filter(repo => !ignoredNames.has(repo.name));
    
    // Get cached repositories to check their status
    const { getAllCachedRepositories } = require('./notion');
    const cachedRepos = await getAllCachedRepositories();
    const cachedRepoMap = new Map();
    
    cachedRepos.forEach(cachedRepo => {
      cachedRepoMap.set(cachedRepo.repository, cachedRepo);
    });
    
    // Load project categories and status from weekly planning data
    const projectMetadata = {};
    try {
      const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
      if (fs.existsSync(weeklyPlansPath)) {
        const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
        const weeklyPlans = JSON.parse(weeklyPlansData);
        
        // Get the most recent weekly plan
        if (weeklyPlans.length > 0) {
          const latestPlan = weeklyPlans[weeklyPlans.length - 1];
          const userAnswers = latestPlan.planData?.userAnswers || {};
          
          // Build project metadata map
          Object.entries(userAnswers).forEach(([projectName, projectData]) => {
            if (projectData.category || projectData.status) {
              projectMetadata[projectName] = {
                category: projectData.category || 'Unknown Category',
                status: projectData.status || 'unknown'
              };
            }
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load project metadata from weekly plans:', error.message);
    }
    
    // Build repository list with cache status
    const repositories = await Promise.all(filteredRepos.map(async repo => {
      const cachedRepo = cachedRepoMap.get(repo.name);
      
      if (cachedRepo) {
        // Repository has been processed and cached
        let status = 'not-processed';
        if (cachedRepo.hasPrd && cachedRepo.hasTaskList) {
          status = 'prd-and-tasks';
        } else if (cachedRepo.hasPrd) {
          status = 'prd-only';
        } else if (cachedRepo.hasTaskList) {
          status = 'tasks-only';
        } else {
          status = 'no-files';
        }
        
        // Get detailed progress data from cache
        let progressDetails = null;
        try {
          const { getCachedScanResult } = require('./notion');
          const detailedCacheData = await getCachedScanResult(repo.name);
          if (detailedCacheData && detailedCacheData.progress) {
            progressDetails = detailedCacheData.progress;
          } else {
            // Calculate progress details from basic data when cache is expired
            const storyCount = cachedRepo.storyCount || 0;
            const taskCount = cachedRepo.taskCount || 0;
            const progressPercentage = cachedRepo.progress || 0;
            
            // Estimate completed stories and tasks based on progress percentage
            const completedStories = Math.round((storyCount * progressPercentage) / 100);
            const completedTasks = Math.round((taskCount * progressPercentage) / 100);
            
            progressDetails = {
              totalStories: storyCount,
              completedStories: completedStories,
              totalTasks: taskCount,
              completedTasks: completedTasks,
              progressPercentage: progressPercentage
            };
          }
        } catch (error) {
          console.warn(`⚠️ Could not get detailed progress for ${repo.name}:`, error.message);
          // Fallback to basic calculation
          const storyCount = cachedRepo.storyCount || 0;
          const taskCount = cachedRepo.taskCount || 0;
          const progressPercentage = cachedRepo.progress || 0;
          
          const completedStories = Math.round((storyCount * progressPercentage) / 100);
          const completedTasks = Math.round((taskCount * progressPercentage) / 100);
          
          progressDetails = {
            totalStories: storyCount,
            completedStories: completedStories,
            totalTasks: taskCount,
            completedTasks: completedTasks,
            progressPercentage: progressPercentage
          };
        }
        
        // Get project metadata
        let metadata = projectMetadata[repo.name];
        
        // If no direct match, try to find a match by extracting the base project name
        if (!metadata) {
          // Try to extract base project name from PRD titles
          const baseName = repo.name.replace(/\s+Product\s+Requirements\s+Document\s+\(PRD\)\s*v?\d*$/i, '').trim();
          metadata = projectMetadata[baseName];
        }
        
        const projectCategory = metadata?.category || 'Unknown Category';
        const projectStatus = metadata?.status || 'unknown';
        
        return {
          name: repo.name,
          status: status,
          prdCount: cachedRepo.hasPrd ? 1 : 0,
          taskCount: cachedRepo.taskCount || 0,
          storyCount: cachedRepo.storyCount || 0,
          progress: cachedRepo.progress || 0,
          progressDetails: progressDetails,
          lastUpdated: cachedRepo.lastScanned || repo.updated_at,
          cached: true,
          category: projectCategory,
          projectStatus: projectStatus
        };
      } else {
        // Repository has not been processed
        // Get project metadata
        let metadata = projectMetadata[repo.name];
        
        // If no direct match, try to find a match by extracting the base project name
        if (!metadata) {
          // Try to extract base project name from PRD titles
          const baseName = repo.name.replace(/\s+Product\s+Requirements\s+Document\s+\(PRD\)\s*v?\d*$/i, '').trim();
          metadata = projectMetadata[baseName];
        }
        
        const projectCategory = metadata?.category || 'Unknown Category';
        const projectStatus = metadata?.status || 'unknown';
        
        return {
          name: repo.name,
          status: 'not-processed',
          prdCount: 0,
          taskCount: 0,
          storyCount: 0,
          progress: 0,
          progressDetails: null,
          lastUpdated: repo.updated_at,
          cached: false,
          category: projectCategory,
          projectStatus: projectStatus
        };
      }
    }));
    
    res.json({
      success: true,
      repositories: repositories,
      totalRepos: repos.length,
      ignoredCount: ignoredRepos.length
    });
  } catch (error) {
    console.error('❌ Error getting repositories list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get repositories list',
      details: error.message 
    });
  }
}));

// Process specific repository for PRD and task-list files
app.post('/api/prd-stories/process-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`🔍 Scanning repository: ${repository}`);
    
    const PrdTaskProcessor = require('./prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    const result = await processor.processRepository(repository);
    
    // Transform the result to match the expected format
    const repositoryData = {
      name: result.repository,
      status: result.hasPrd ? (result.hasTaskList ? 'prd-and-tasks' : 'prd-only') : (result.hasTaskList ? 'tasks-only' : 'no-files'),
      prdCount: result.hasPrd ? 1 : 0,
      taskCount: result.tasks ? result.tasks.length : 0,
      storyCount: result.stories ? result.stories.length : 0,
      progress: result.progress ? result.progress.progressPercentage : 0,
      lastUpdated: result.lastUpdated,
      stories: result.stories,
      tasks: result.tasks,
      progressDetails: result.progress
    };
    
    // Update progress cache
    const progressData = {
      repository: repositoryData.name,
      progress: result.progress,
      lastUpdated: result.lastUpdated
    };
    
    // Update cache for this specific repository
    progressCache.set(repository, {
      data: [progressData],
      timestamp: Date.now()
    });
    
    // Update cache for 'all' repositories
    const allCached = progressCache.get('all');
    if (allCached) {
      const existingIndex = allCached.data.findIndex(p => p.repository === repository);
      if (existingIndex >= 0) {
        allCached.data[existingIndex] = progressData;
      } else {
        allCached.data.push(progressData);
      }
      allCached.timestamp = Date.now();
    }

    // Return response immediately
    res.json({
      success: true,
      repository: repositoryData
    });
    
    // Store in Notion asynchronously (don't wait for it)
    if (result.stories && result.stories.length > 0) {
      setImmediate(async () => {
        try {
          await storeProjectProgressInNotion(repositoryData);
          console.log(`✅ Stored ${repository} progress in Notion`);
        } catch (notionError) {
          console.warn(`⚠️ Failed to store ${repository} in Notion:`, notionError.message);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error processing repository:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scan repository',
      details: error.message 
    });
  }
}));

// Ignore repository
app.post('/api/prd-stories/ignore-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`🚫 Ignoring repository: ${repository}`);
    
    // Read existing ignored repositories
    const ignoredPath = path.join(__dirname, 'data', 'ignored-repos.json');
    let ignoredRepos = [];
    
    if (fs.existsSync(ignoredPath)) {
      try {
        const data = fs.readFileSync(ignoredPath, 'utf8');
        ignoredRepos = JSON.parse(data);
      } catch (error) {
        console.warn('⚠️ Error reading ignored repos file:', error.message);
      }
    }
    
    // Add repository to ignored list if not already there
    if (!ignoredRepos.find(repo => repo.name === repository)) {
      ignoredRepos.push({
        name: repository,
        ignoredAt: new Date().toISOString(),
        reason: 'User ignored'
      });
      
      // Save updated list
      fs.writeFileSync(ignoredPath, JSON.stringify(ignoredRepos, null, 2));
      console.log(`✅ Added ${repository} to ignored list`);
    }
    
    res.json({
      success: true,
      message: `Repository ${repository} has been ignored`,
      ignoredCount: ignoredRepos.length
    });
  } catch (error) {
    console.error('❌ Error ignoring repository:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ignore repository',
      details: error.message 
    });
  }
}));

// Get ignored repositories
app.get('/api/prd-stories/ignored', asyncHandler(async (req, res) => {
  try {
    console.log('📋 Getting ignored repositories...');
    
    const ignoredPath = path.join(__dirname, 'data', 'ignored-repos.json');
    let ignoredRepos = [];
    
    if (fs.existsSync(ignoredPath)) {
      try {
        const data = fs.readFileSync(ignoredPath, 'utf8');
        ignoredRepos = JSON.parse(data);
      } catch (error) {
        console.warn('⚠️ Error reading ignored repos file:', error.message);
      }
    }
    
        res.json({
          success: true,
      repositories: ignoredRepos
        });
  } catch (error) {
    console.error('❌ Error getting ignored repositories:', error);
        res.status(500).json({
          success: false,
      error: 'Failed to get ignored repositories',
      details: error.message 
    });
  }
}));

// Unignore repository
app.post('/api/prd-stories/unignore-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`🔄 Unignoring repository: ${repository}`);
    
    const ignoredPath = path.join(__dirname, 'data', 'ignored-repos.json');
    let ignoredRepos = [];
    
    if (fs.existsSync(ignoredPath)) {
      try {
        const data = fs.readFileSync(ignoredPath, 'utf8');
        ignoredRepos = JSON.parse(data);
  } catch (error) {
        console.warn('⚠️ Error reading ignored repos file:', error.message);
      }
    }
    
    // Remove repository from ignored list
    const originalLength = ignoredRepos.length;
    ignoredRepos = ignoredRepos.filter(repo => repo.name !== repository);
    
    if (ignoredRepos.length < originalLength) {
      // Save updated list
      fs.writeFileSync(ignoredPath, JSON.stringify(ignoredRepos, null, 2));
      console.log(`✅ Removed ${repository} from ignored list`);
      
      res.json({
        success: true,
        message: `Repository ${repository} has been unignored`,
        ignoredCount: ignoredRepos.length
      });
    } else {
      res.json({
        success: false,
        message: `Repository ${repository} was not in the ignored list`
      });
    }
  } catch (error) {
    console.error('❌ Error unignoring repository:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to unignore repository',
      details: error.message 
    });
  }
}));

// Add new PRD story
app.post('/api/prd-stories', asyncHandler(async (req, res) => {
  try {
    const { projectName, storyTitle, status, priority, storyPoints, repository, notes } = req.body;
    
    if (!projectName || !storyTitle || !status) {
      return res.status(400).json({ error: 'Missing required fields: projectName, storyTitle, status' });
    }
    
    console.log(`📝 Adding new PRD story: ${storyTitle} for project ${projectName}`);
    
    const { addPrdStoryEntry } = require('./notion');
    const result = await addPrdStoryEntry({
      projectName,
      storyTitle,
      status,
      priority,
      storyPoints,
      repository,
      notes
    });
      
      res.json({
        success: true,
      message: 'Story added successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error adding PRD story:', error);
    res.status(500).json({ 
      error: 'Error adding PRD story',
      details: error.message 
    });
  }
}));

// Update existing PRD story
app.put('/api/prd-stories/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing story ID' });
    }
    
    console.log(`📝 Updating PRD story: ${id}`);
    
    const { updatePrdStoryEntry } = require('./notion');
    const result = await updatePrdStoryEntry(id, updates);
    
    res.json({
      success: true,
      message: 'Story updated successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error updating PRD story:', error);
    res.status(500).json({ 
      error: 'Error updating PRD story',
      details: error.message 
    });
  }
}));



// Helper function to extract stories from PRD content
function extractStoriesFromContent(content, projectName) {
  const stories = [];
  const lines = content.split('\n');
  
  // Better story extraction patterns - focus on actual story titles
  const storyPatterns = [
    // Epic headers: ## Epic 1: [Story Title]
    /^#{1,3}\s+Epic\s+\d+:\s*(.+)$/gm,
    // Story headers: #### Story 1.1: [Story Title]
    /^#{1,6}\s+Story\s+\d+\.\d+:\s*(.+)$/gm,
    // User Story format: As a [user], I want [action], so that [benefit]
    /^As\s+a\s+([^,]+),\s+I\s+want\s+([^,]+),\s+so\s+that\s+(.+)$/gm,
    // Feature headers: ### [Feature Name]
    /^#{1,3}\s+([^#\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
    // Bullet points with meaningful content (not just status)
    /^[-*]\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
    // Numbered lists with meaningful content
    /^\d+\.\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm
  ];
  
  // Common PRD section headers to exclude from story extraction
  const sectionHeaderPatterns = [
    /^\d+\.\s+(Executive Summary|Goals and Background Context|Requirements|User Experience|Technical Specifications|Constraints and Assumptions|Success Criteria|Timeline and Milestones|Appendices|Project Metadata|Template Usage Notes)/i,
    /^(Executive Summary|Goals and Background Context|Requirements|User Experience|Technical Specifications|Constraints and Assumptions|Success Criteria|Timeline and Milestones|Appendices|Project Metadata|Template Usage Notes)$/i,
    /^\d+\.\d+\s+(Functional Requirements|Non-Functional Requirements)/i,
    /^(Functional Requirements|Non-Functional Requirements)$/i,
    /^\d+\.\s+[A-Z][a-z]+\s+(and|&)\s+[A-Z][a-z]+/i, // Pattern like "Goals and Background Context"
    /^\d+\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i, // Pattern like "Executive Summary"
    /^[A-Z]{2,3}\d*:/i, // Pattern like "FR1:", "NFR1:", "AC1:"
    /^\d+\.\d+\s+[A-Z]/i, // Pattern like "3.2 Non" (incomplete section headers)
    /^Project\s+[A-Z]/i, // Pattern like "Project Title Here"
    /^Epic\s+\d+:/i, // Pattern like "Epic 1:" (should be handled by epic pattern)
    /^[A-Z][a-z]+\s+[A-Z]+\s+[A-Z]+$/i // Pattern like "Test Project PRD"
  ];
  
  // Status indicators to avoid extracting as titles
  const statusOnlyWords = ['IMPLEMENTED', 'DESIGNED', 'PLANNED', 'REVIEW', 'ACTIVE', 'DONE', 'TODO', 'IN PROGRESS'];
  
  // Priority indicators
  const priorityIndicators = {
    'high': 5, 'critical': 5, 'urgent': 5,
    'medium': 3, 'normal': 3,
    'low': 1, 'nice-to-have': 1, 'future': 1
  };
  
  // Story point indicators
  const storyPointIndicators = {
    '1': 1, '2': 2, '3': 3, '5': 5, '8': 8, '13': 13, '21': 21
  };
  
  // Standard statuses
  const standardStatuses = ['Idea', 'Planning', 'Active', 'Review', 'Done'];
  
  const seenTitles = new Set(); // For deduplication
  
  for (const pattern of storyPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      let title = match[1]?.trim();
      let description = match[2]?.trim() || '';
      
      // Skip if title is just a status word
      if (!title || statusOnlyWords.includes(title.toUpperCase())) {
        continue;
      }
      
      // Skip if title is too short or generic
      if (title.length < 5 || title.toLowerCase().includes('status') || title.toLowerCase().includes('progress')) {
        continue;
      }
      
      // Skip if title matches common PRD section headers
      const isSectionHeader = sectionHeaderPatterns.some(headerPattern => 
        headerPattern.test(title) || headerPattern.test(match[0])
      );
      if (isSectionHeader) {
        continue;
      }
      
      // Create a normalized title for deduplication
      const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (seenTitles.has(normalizedTitle)) {
        continue; // Skip duplicates
      }
      seenTitles.add(normalizedTitle);
      
      // Determine priority from title/content
      let priority = 3; // Default medium
      const titleLower = title.toLowerCase();
      for (const [indicator, value] of Object.entries(priorityIndicators)) {
        if (titleLower.includes(indicator)) {
          priority = value;
          break;
        }
      }
      
      // Determine story points
      let storyPoints = null;
      for (const [indicator, value] of Object.entries(storyPointIndicators)) {
        if (titleLower.includes(indicator)) {
          storyPoints = indicator;
          break;
        }
      }
      
      // Determine status from context or default
      let storyStatus = 'Idea'; // Default
      const fullText = (title + ' ' + description).toLowerCase();
      for (const standardStatus of standardStatuses) {
        if (fullText.includes(standardStatus.toLowerCase())) {
          storyStatus = standardStatus;
          break;
        }
      }
      
      stories.push({
        projectName,
        title: title,
        status: storyStatus,
        priority,
        storyPoints,
        notes: description ? `Description: ${description}` : `Extracted from PRD: ${title}`
      });
    }
  }
  
  return stories;
}

// Store project progress in Notion
async function storeProjectProgressInNotion(repositoryData) {
  try {
    // Ensure project progress database exists
    const projectDbId = await ensureProjectProgressDatabase();
    
    // Create or update project entry
    const projectEntry = {
      parent: { database_id: projectDbId },
      properties: {
        'Project Name': {
          title: [{ text: { content: repositoryData.name } }]
        },
        'Repository': {
          rich_text: [{ text: { content: repositoryData.name } }]
        },
        'Status': {
          select: { name: repositoryData.status }
        },
        'Progress': {
          number: repositoryData.progress
        },
        'Stories Total': {
          number: repositoryData.storyCount
        },
        'Stories Completed': {
          number: repositoryData.progressDetails ? repositoryData.progressDetails.completedStories : 0
        },
        'Tasks Total': {
          number: repositoryData.taskCount
        },
        'Tasks Completed': {
          number: repositoryData.progressDetails ? repositoryData.progressDetails.completedTasks : 0
        },
        'Last Updated': {
          date: { start: new Date().toISOString() }
        },
        'Has PRD': {
          checkbox: repositoryData.prdCount > 0
        },
        'Has Task List': {
          checkbox: repositoryData.taskCount > 0
        }
      }
    };
    
    // Check if project already exists
    const existingProjects = await notion.databases.query({
      database_id: projectDbId,
      filter: {
        property: 'Repository',
        rich_text: { equals: repositoryData.name }
      }
    });
    
    if (existingProjects.results.length > 0) {
      // Update existing project
      await notion.pages.update({
        page_id: existingProjects.results[0].id,
        properties: projectEntry.properties
      });
      console.log(`📝 Updated project ${repositoryData.name} in Notion`);
    } else {
      // Create new project
      await notion.pages.create(projectEntry);
      console.log(`📝 Created project ${repositoryData.name} in Notion`);
    }
    
    // Store individual stories if we have them
    if (repositoryData.stories && repositoryData.stories.length > 0) {
      await storeStoriesInNotion(repositoryData.stories, repositoryData.name);
    }
    
  } catch (error) {
    console.error('❌ Error storing project progress in Notion:', error);
    throw error;
  }
}

// Store individual stories in Notion
async function storeStoriesInNotion(stories, repositoryName) {
  try {
    // Ensure story progress database exists
    const storyDbId = await ensureStoryProgressDatabase();
    
    // Get all existing stories for this repository
    const existingStories = await notion.databases.query({
      database_id: storyDbId,
      filter: {
        property: 'Repository',
        rich_text: { equals: repositoryName }
      }
    });
    
    const currentStoryTitles = new Set(stories.map(story => story.title.toLowerCase().trim()));
    const storiesToArchive = [];
    
    // Find stories that no longer exist in the current PRD
    for (const existingStory of existingStories.results) {
      const existingTitle = existingStory.properties['Story Title']?.title?.[0]?.text?.content;
      if (existingTitle && !currentStoryTitles.has(existingTitle.toLowerCase().trim())) {
        storiesToArchive.push(existingStory);
      }
    }
    
    // Archive old stories that are no longer in the PRD
    if (storiesToArchive.length > 0) {
      console.log(`🗑️ Archiving ${storiesToArchive.length} old stories that are no longer in PRD for ${repositoryName}`);
      for (const storyToArchive of storiesToArchive) {
        try {
          await notion.pages.update({
            page_id: storyToArchive.id,
            archived: true
          });
          console.log(`🗑️ Archived old story: ${storyToArchive.properties['Story Title']?.title?.[0]?.text?.content}`);
        } catch (error) {
          console.error(`❌ Failed to archive old story:`, error.message);
        }
      }
    }
    
    // Process current stories (add new ones or update existing ones)
    for (const story of stories) {
      const storyEntry = {
        parent: { database_id: storyDbId },
        properties: {
          'Story Title': {
            title: [{ text: { content: story.title } }]
          },
          'Repository': {
            rich_text: [{ text: { content: repositoryName } }]
          },
          'Epic': {
            rich_text: [{ text: { content: story.epic || 'Uncategorized' } }]
          },
          'Status': {
            select: { name: String(story.status || 'Not Started') }
          },
          'Priority': {
            select: { name: String(story.priority || 'Medium') }
          },
          'Story Points': {
            number: story.storyPoints || 0
          },
          'Notes': {
            rich_text: [{ text: { content: story.notes || '' } }]
          },
          'Last Updated': {
            date: { start: new Date().toISOString() }
          }
        }
      };
      
      // Check if story already exists
      const existingStoriesForTitle = await notion.databases.query({
        database_id: storyDbId,
        filter: {
          and: [
            {
              property: 'Repository',
              rich_text: { equals: repositoryName }
            },
            {
              property: 'Story Title',
              title: { equals: story.title }
            }
          ]
        }
      });
      
      if (existingStoriesForTitle.results.length > 0) {
        // Update existing story
        await notion.pages.update({
          page_id: existingStoriesForTitle.results[0].id,
          properties: storyEntry.properties
        });
      } else {
        // Create new story
        await notion.pages.create(storyEntry);
      }
    }
    
    console.log(`📝 Stored ${stories.length} stories for ${repositoryName} in Notion (archived ${storiesToArchive.length} old stories)`);
  } catch (error) {
    console.error('❌ Error storing stories in Notion:', error);
    throw error;
  }
}

// Ensure project progress database exists
async function ensureProjectProgressDatabase() {
  const dbId = process.env.NOTION_PROJECT_PROGRESS_DATABASE_ID;
  
  if (dbId) {
    try {
      await notion.databases.retrieve({ database_id: dbId });
      console.log(`✅ Using existing project progress database: ${dbId}`);
      return dbId;
    } catch (error) {
      console.warn('⚠️ Project progress database ID invalid, searching for existing database');
    }
  }
  
  // Search for existing Project Progress database
  try {
    const searchResponse = await notion.search({
      query: 'Project Progress',
      filter: {
        property: 'object',
        value: 'database'
      }
    });
    
    if (searchResponse.results.length > 0) {
      const existingDb = searchResponse.results[0];
      console.log(`✅ Found existing project progress database: ${existingDb.id}`);
      return existingDb.id;
    }
  } catch (error) {
    console.warn('⚠️ Error searching for existing database:', error.message);
  }
  
  // Only create new database if none exists
  console.log('📝 Creating new project progress database...');
  const response = await notion.databases.create({
    parent: { page_id: process.env.NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID },
    title: [{ text: { content: 'Project Progress' } }],
    properties: {
      'Project Name': { title: {} },
      'Repository': { rich_text: {} },
      'Status': { 
        select: { 
          options: [
            { name: 'not-processed', color: 'gray' },
            { name: 'prd-only', color: 'blue' },
            { name: 'tasks-only', color: 'yellow' },
            { name: 'prd-and-tasks', color: 'green' },
            { name: 'no-files', color: 'red' }
          ]
        }
      },
      'Progress': { number: { format: 'percent' } },
      'Stories Total': { number: {} },
      'Stories Completed': { number: {} },
      'Tasks Total': { number: {} },
      'Tasks Completed': { number: {} },
      'Last Updated': { date: {} },
      'Has PRD': { checkbox: {} },
      'Has Task List': { checkbox: {} }
    }
  });
  
  console.log(`✅ Created new project progress database: ${response.id}`);
  return response.id;
}

// Ensure story progress database exists
async function ensureStoryProgressDatabase() {
  const dbId = process.env.NOTION_STORY_PROGRESS_DATABASE_ID;
  
  if (dbId) {
    try {
      await notion.databases.retrieve({ database_id: dbId });
      console.log(`✅ Using existing story progress database: ${dbId}`);
      return dbId;
    } catch (error) {
      console.warn('⚠️ Story progress database ID invalid, searching for existing database');
    }
  }
  
  // Search for existing Story Progress database
  try {
    const searchResponse = await notion.search({
      query: 'Story Progress',
      filter: {
        property: 'object',
        value: 'database'
      }
    });
    
    if (searchResponse.results.length > 0) {
      const existingDb = searchResponse.results[0];
      console.log(`✅ Found existing story progress database: ${existingDb.id}`);
      return existingDb.id;
    }
  } catch (error) {
    console.warn('⚠️ Error searching for existing database:', error.message);
  }
  
  // Only create new database if none exists
  console.log('📝 Creating new story progress database...');
  const response = await notion.databases.create({
    parent: { page_id: process.env.NOTION_WEEKLY_PROJECT_PLAN_PARENT_PAGE_ID },
    title: [{ text: { content: 'Story Progress' } }],
    properties: {
      'Story Title': { title: {} },
      'Repository': { rich_text: {} },
      'Epic': { rich_text: {} },
      'Status': { 
        select: { 
          options: [
            { name: 'Not Started', color: 'gray' },
            { name: 'In Progress', color: 'yellow' },
            { name: 'Completed', color: 'green' },
            { name: 'Blocked', color: 'red' }
          ]
        }
      },
      'Priority': { 
        select: { 
          options: [
            { name: 'Low', color: 'gray' },
            { name: 'Medium', color: 'yellow' },
            { name: 'High', color: 'red' },
            { name: 'Critical', color: 'red' }
          ]
        }
      },
      'Story Points': { number: {} },
      'Notes': { rich_text: {} },
      'Last Updated': { date: {} }
    }
  });
  
  console.log(`✅ Created new story progress database: ${response.id}`);
  return response.id;
}

// ============================================================================
// COMMIT LOGGING API ENDPOINTS FOR WANDERJOB
// ============================================================================

// Rate limiting for backfill operations
const backfillAttempts = new Map();
const BACKFILL_LIMITS = {
  perHour: 5,        // Max 5 backfills per hour
  perDay: 20,        // Max 20 backfills per day
  cooldown: 300000   // 5 minutes between attempts
};

// Helper function to check rate limits
function checkBackfillRateLimit(apiKey) {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const dayAgo = now - (24 * 60 * 60 * 1000);
  
  if (!backfillAttempts.has(apiKey)) {
    backfillAttempts.set(apiKey, []);
  }
  
  const attempts = backfillAttempts.get(apiKey);
  
  // Clean old attempts
  const recentAttempts = attempts.filter(timestamp => timestamp > hourAgo);
  const dailyAttempts = attempts.filter(timestamp => timestamp > dayAgo);
  
  backfillAttempts.set(apiKey, recentAttempts);
  
  // Check rate limits
  if (recentAttempts.length >= BACKFILL_LIMITS.perHour) {
    return { allowed: false, reason: 'Hourly limit exceeded', retryAfter: 3600 };
  }
  
  if (dailyAttempts.length >= BACKFILL_LIMITS.perDay) {
    return { allowed: false, reason: 'Daily limit exceeded', retryAfter: 86400 };
  }
  
  // Check cooldown
  const lastAttempt = recentAttempts[recentAttempts.length - 1];
  if (lastAttempt && (now - lastAttempt) < BACKFILL_LIMITS.cooldown) {
    return { allowed: false, reason: 'Cooldown period active', retryAfter: Math.ceil((BACKFILL_LIMITS.cooldown - (now - lastAttempt)) / 1000) };
  }
  
  return { allowed: true };
}

// Helper function to validate date range
function validateBackfillDate(date) {
  const today = new Date();
  const maxBackfillDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const minBackfillDate = new Date(today.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago (default)
  
  const requestDate = new Date(date);
  
  if (requestDate > today) {
    return { valid: false, reason: 'Cannot backfill future dates' };
  }
  
  if (requestDate < maxBackfillDate) {
    return { valid: false, reason: 'Cannot backfill dates older than 30 days' };
  }
  
  return { valid: true, date: requestDate };
}

// Helper function to authenticate API key
function authenticateBackfillKey(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedKey = process.env.BACKFILL_API_KEY;
  
  if (!expectedKey) {
    return { authenticated: false, reason: 'Backfill API key not configured' };
  }
  
  if (!apiKey) {
    return { authenticated: false, reason: 'API key required' };
  }
  
  if (apiKey !== expectedKey) {
    return { authenticated: false, reason: 'Invalid API key' };
  }
  
  return { authenticated: true, apiKey: apiKey };
}

// POST /api/commits - Log commits (extend existing webhook logic)
app.post('/api/commits', asyncHandler(async (req, res) => {
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
app.get('/api/commits/:date', asyncHandler(async (req, res) => {
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
      const rateLimit = checkBackfillRateLimit(auth.apiKey || 'default');
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
      
      console.log(`🔄 Backfilling commits for date: ${date}...`);
      
      // Trigger backfill for the date
      try {
        const { generateCommitLog } = require('./generate-commit-log');
        await generateCommitLog(date, date);
        
        // Record the backfill attempt
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || 'default';
        if (!backfillAttempts.has(apiKey)) {
          backfillAttempts.set(apiKey, []);
        }
        backfillAttempts.get(apiKey).push(Date.now());
        
        console.log(`✅ Backfill completed for ${date}`);
      } catch (backfillError) {
        console.error(`❌ Backfill failed for ${date}:`, backfillError.message);
        return res.status(500).json({ 
          success: false,
          error: 'Backfill failed',
          details: backfillError.message 
        });
      }
    }
    
    console.log(`📊 Fetching commits for date: ${date}...`);
    
    // Query Notion for commits on this date
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;
    
    // Calculate date range for the day (start and end of day in user's timezone)
    const timezoneInfo = timezoneConfig.getTimezoneInfo();
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
    
    // Convert to user's timezone
    const startOfDayLocal = new Date(startOfDay.toLocaleString('en-US', { timeZone: timezoneInfo.timezone }));
    const endOfDayLocal = new Date(endOfDay.toLocaleString('en-US', { timeZone: timezoneInfo.timezone }));
    
    let allCommits = [];
    let hasMore = true;
    let startCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: "Date",
              date: {
                on_or_after: startOfDayLocal.toISOString()
              }
            },
            {
              property: "Date", 
              date: {
                on_or_before: endOfDayLocal.toISOString()
              }
            }
          ]
        },
        page_size: 100,
        start_cursor: startCursor
      });
      
      // Process commits and convert to API format
      for (const page of response.results) {
        const properties = page.properties;
        const commitMessage = properties["Commits"]?.rich_text?.[0]?.plain_text;
        const projectName = properties["Project Name"]?.title?.[0]?.plain_text;
        const commitDate = properties["Date"]?.date?.start;
        const sha = properties["SHA"]?.rich_text?.[0]?.plain_text;
        
        if (commitMessage && projectName && commitDate) {
          // Generate a consistent ID for the commit
          const commitId = `${projectName}-${sha || page.id}-${Date.now()}`;
          
          allCommits.push({
            id: commitId,
            hash: sha || null,
            message: commitMessage,
            author: null, // Not stored in current system
            date: commitDate,
            projectId: projectName,
            filesChanged: null, // Not stored in current system
            additions: null, // Not stored in current system
            deletions: null // Not stored in current system
          });
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`✅ Found ${allCommits.length} commits for ${date}`);
    
    res.json({
      success: true,
      commits: allCommits,
      count: allCommits.length,
      date: date
    });
    
  } catch (error) {
    console.error('❌ Error fetching commits for date:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching commits',
      details: error.message 
    });
  }
}));

// GET /api/commits/summary/{date} - Get daily summary for specific date
app.get('/api/commits/summary/:date', asyncHandler(async (req, res) => {
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
      const rateLimit = checkBackfillRateLimit(auth.apiKey || 'default');
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
      
      console.log(`🔄 Backfilling commits for summary date: ${date}...`);
      
      // Trigger backfill for the date
      try {
        const { generateCommitLog } = require('./generate-commit-log');
        await generateCommitLog(date, date);
        
        // Record the backfill attempt
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || 'default';
        if (!backfillAttempts.has(apiKey)) {
          backfillAttempts.set(apiKey, []);
        }
        backfillAttempts.get(apiKey).push(Date.now());
        
        console.log(`✅ Backfill completed for summary ${date}`);
      } catch (backfillError) {
        console.error(`❌ Backfill failed for summary ${date}:`, backfillError.message);
        return res.status(500).json({ 
          success: false,
          error: 'Backfill failed',
          details: backfillError.message 
        });
      }
    }
    
    console.log(`📊 Generating daily summary for date: ${date}...`);
    
    // Get commits for this date using the existing endpoint logic
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID;
    
    // Calculate date range for the day
    const timezoneInfo = timezoneConfig.getTimezoneInfo();
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
    
    const startOfDayLocal = new Date(startOfDay.toLocaleString('en-US', { timeZone: timezoneInfo.timezone }));
    const endOfDayLocal = new Date(endOfDay.toLocaleString('en-US', { timeZone: timezoneInfo.timezone }));
    
    let allCommits = [];
    let hasMore = true;
    let startCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: "Date",
              date: {
                on_or_after: startOfDayLocal.toISOString()
              }
            },
            {
              property: "Date", 
              date: {
                on_or_before: endOfDayLocal.toISOString()
              }
            }
          ]
        },
        page_size: 100,
        start_cursor: startCursor
      });
      
      for (const page of response.results) {
        const properties = page.properties;
        const commitMessage = properties["Commits"]?.rich_text?.[0]?.plain_text;
        const projectName = properties["Project Name"]?.title?.[0]?.plain_text;
        const commitDate = properties["Date"]?.date?.start;
        
        if (commitMessage && projectName && commitDate) {
          allCommits.push({
            message: commitMessage,
            projectName: projectName,
            date: commitDate
          });
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    // Generate summary data
    const projectStats = {};
    let totalCommits = allCommits.length;
    let totalAdditions = 0; // Not available in current system
    let totalDeletions = 0; // Not available in current system
    
    // Group by project
    allCommits.forEach(commit => {
      if (!projectStats[commit.projectName]) {
        projectStats[commit.projectName] = {
          projectId: commit.projectName,
          projectName: commit.projectName,
          commits: 0,
          additions: 0,
          deletions: 0
        };
      }
      projectStats[commit.projectName].commits++;
    });
    
    // Convert to array format
    const projects = Object.values(projectStats);
    
    // Basic theme detection from commit messages
    const themes = [];
    const messages = allCommits.map(c => c.message.toLowerCase());
    
    if (messages.some(msg => msg.includes('feat') || msg.includes('feature'))) {
      themes.push('Feature Development');
    }
    if (messages.some(msg => msg.includes('fix') || msg.includes('bug'))) {
      themes.push('Bug Fixes');
    }
    if (messages.some(msg => msg.includes('refactor') || msg.includes('clean'))) {
      themes.push('Code Refactoring');
    }
    if (messages.some(msg => msg.includes('ui') || msg.includes('component') || msg.includes('style'))) {
      themes.push('UI/UX Improvements');
    }
    if (messages.some(msg => msg.includes('test') || msg.includes('spec'))) {
      themes.push('Testing');
    }
    if (messages.some(msg => msg.includes('doc') || msg.includes('readme'))) {
      themes.push('Documentation');
    }
    
    // Default theme if none detected
    if (themes.length === 0) {
      themes.push('General Development');
    }
    
    // Calculate top files (simplified - just count project activity)
    const topFiles = projects
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5)
      .map(project => ({
        file: project.projectName,
        changes: project.commits
      }));
    
    const summary = {
      date: date,
      totalCommits: totalCommits,
      totalAdditions: totalAdditions,
      totalDeletions: totalDeletions,
      projects: projects,
      themes: themes,
      summary: `Today had ${totalCommits} commits across ${projects.length} projects. The main focus was on ${projects[0]?.projectName || 'various projects'}. The work spanned ${themes.length} key areas: ${themes.join(', ').toLowerCase()}. Overall, this shows steady progress with focused, incremental improvements.`,
      topFiles: topFiles
    };
    
    console.log(`✅ Generated summary for ${date}: ${totalCommits} commits, ${projects.length} projects`);
    
    res.json({
      success: true,
      summary: summary
    });
    
  } catch (error) {
    console.error('❌ Error generating daily summary:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error generating daily summary',
      details: error.message 
    });
  }
}));

// POST /api/commits/backfill - Dedicated backfill endpoint
app.post('/api/commits/backfill', asyncHandler(async (req, res) => {
  try {
    const { date, projects } = req.body;
    
    // Authenticate API key
    const auth = authenticateBackfillKey(req);
    if (!auth.authenticated) {
      return res.status(401).json({ 
        success: false,
        error: auth.reason 
      });
    }
    
    // Check rate limits
    const rateLimit = checkBackfillRateLimit(auth.apiKey || 'default');
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        success: false,
        error: rateLimit.reason,
        retryAfter: rateLimit.retryAfter
      });
    }
    
    // Validate date
    if (!date) {
      return res.status(400).json({ 
        success: false,
        error: 'Date is required' 
      });
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD' 
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
    
    // Validate projects array (optional, but if provided, limit size)
    if (projects && Array.isArray(projects)) {
      const MAX_PROJECTS = 10;
      if (projects.length > MAX_PROJECTS) {
        return res.status(400).json({ 
          success: false,
          error: `Too many projects. Maximum ${MAX_PROJECTS} allowed` 
        });
      }
    }
    
    console.log(`🔄 Starting dedicated backfill for date: ${date}${projects ? `, projects: ${projects.join(', ')}` : ''}...`);
    
    // Trigger backfill for the date
    try {
      const { generateCommitLog } = require('./generate-commit-log');
      await generateCommitLog(date, date);
      
      // Record the backfill attempt
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || 'default';
      if (!backfillAttempts.has(apiKey)) {
        backfillAttempts.set(apiKey, []);
      }
      backfillAttempts.get(apiKey).push(Date.now());
      
      console.log(`✅ Dedicated backfill completed for ${date}`);
      
      res.json({
        success: true,
        message: `Backfill completed for ${date}`,
        date: date,
        projects: projects || 'all',
        timestamp: new Date().toISOString()
      });
      
    } catch (backfillError) {
      console.error(`❌ Dedicated backfill failed for ${date}:`, backfillError.message);
      res.status(500).json({ 
        success: false,
        error: 'Backfill failed',
        details: backfillError.message 
      });
    }
    
  } catch (error) {
    console.error('❌ Error in dedicated backfill endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
}));

// ============================================================================
// EXISTING API ENDPOINTS
// ============================================================================

// Projects API endpoint for external consumption (e.g., Wanderjob)
app.get('/api/projects', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching projects data for external API...');
    
    // Read existing commit log
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      try {
        const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
        commitLog = JSON.parse(data);
      } catch (error) {
        console.error('❌ Error reading commit log:', error.message);
        return res.status(500).json({ error: 'Failed to read commit log' });
      }
    }
    
    // Calculate date range (90 days ago from today for better project visibility)
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().split('T')[0];
    
    // Filter data to last 90 days
    const recentData = commitLog.filter(day => day.date >= startDate);
    
    // Aggregate data by project
    const projectData = {};
    
    recentData.forEach(day => {
      Object.entries(day.projects).forEach(([projectName, commitCount]) => {
        if (!projectData[projectName]) {
          projectData[projectName] = {
            name: projectName,
            totalCommits: 0,
            activityDates: [],
            lastActivity: null,
            category: null,
            status: 'unknown'
          };
        }
        
        projectData[projectName].totalCommits += commitCount;
        projectData[projectName].activityDates.push(day.date);
        
        const activityDate = new Date(day.date);
        if (!projectData[projectName].lastActivity || activityDate > new Date(projectData[projectName].lastActivity)) {
          projectData[projectName].lastActivity = day.date;
        }
      });
    });
    
    // Load category and status data from weekly planning data
    try {
      const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
      if (fs.existsSync(weeklyPlansPath)) {
        const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
        const weeklyPlans = JSON.parse(weeklyPlansData);
        
        // Get the most recent weekly plan
        if (weeklyPlans.length > 0) {
          const latestPlan = weeklyPlans[weeklyPlans.length - 1];
          const userAnswers = latestPlan.planData?.userAnswers || {};
          
          // Apply categories and status to projects
          Object.values(projectData).forEach(project => {
            const savedProject = userAnswers[project.name];
            if (savedProject) {
              if (savedProject.category) {
                project.category = savedProject.category;
              }
              if (savedProject.status) {
                project.status = savedProject.status;
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load category data from weekly plans:', error.message);
    }
    
    // Get project colors
    const { getAllProjectColors } = require('./color-palette');
    const projectColorMap = getAllProjectColors();
    
    // Get progress data from Notion cache if available
    const { getAllCachedRepositories } = require('./notion');
    let cachedRepos = [];
    try {
      cachedRepos = await getAllCachedRepositories();
    } catch (error) {
      console.warn('⚠️ Could not load cached repository data:', error.message);
    }
    
    const cachedRepoMap = new Map();
    cachedRepos.forEach(cachedRepo => {
      cachedRepoMap.set(cachedRepo.repository, cachedRepo);
    });
    
    // Build final project list
    const projects = Object.values(projectData).map(project => {
      const cachedRepo = cachedRepoMap.get(project.name);
      const colorData = projectColorMap[project.name];
      
      // Determine project status based on activity and planning data
      let status = project.status;
      if (status === 'unknown') {
        const daysSinceActivity = project.lastActivity ? 
          Math.floor((new Date() - new Date(project.lastActivity)) / (1000 * 60 * 60 * 24)) : 999;
        
        if (daysSinceActivity <= 7) {
          status = 'active';
        } else if (daysSinceActivity <= 30) {
          status = 'planning';
        } else {
          status = 'paused';
        }
      }
      
      return {
        name: project.name,
        status: status,
        progress: cachedRepo ? (cachedRepo.progress || 0) : 0,
        category: project.category || 'Miscellaneous / Standalone',
        lastActivity: project.lastActivity,
        totalCommits: project.totalCommits,
        hasPrd: cachedRepo ? cachedRepo.hasPrd : false,
        hasTaskList: cachedRepo ? cachedRepo.hasTaskList : false,
        storiesTotal: cachedRepo ? (cachedRepo.storyCount || 0) : 0,
        storiesCompleted: cachedRepo ? Math.round(((cachedRepo.storyCount || 0) * (cachedRepo.progress || 0)) / 100) : 0,
        color: colorData ? colorData.hex : '#6B7280',
        repository: project.name
      };
    });
    
    // Sort projects by activity (most recent first)
    projects.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity) - new Date(a.lastActivity);
    });
    
    res.json({
      success: true,
      projects: projects,
      lastUpdated: new Date().toISOString(),
      totalProjects: projects.length,
      dateRange: {
        start: startDate,
        end: today.toISOString().split('T')[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching projects data:', error);
    res.status(500).json({ 
      error: 'Error fetching projects data',
      details: error.message 
    });
  }
}));

// Color palette management endpoints
app.get('/api/color-palette/stats', asyncHandler(async (req, res) => {
  try {
    const stats = getColorStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error getting color stats:', error);
    res.status(500).json({ 
      error: 'Error getting color statistics',
      details: error.message 
    });
  }
}));

// Get color for specific project
app.get('/api/color-palette/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const color = getProjectColor(projectName);
    
    if (color) {
      res.json({
        success: true,
        color
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Project color not found'
      });
    }
  } catch (error) {
    console.error('❌ Error getting project color:', error);
    res.status(500).json({ 
      error: 'Error getting project color',
      details: error.message 
    });
  }
}));

// Update project color
app.put('/api/color-palette/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    
    const color = updateProjectColor(projectName, category);
    
    res.json({
      success: true,
      color,
      message: `Updated color for ${projectName}`
    });
  } catch (error) {
    console.error('❌ Error updating project color:', error);
    res.status(500).json({ 
      error: 'Error updating project color',
      details: error.message 
    });
  }
}));

// Generate palette for category
app.post('/api/color-palette/generate', asyncHandler(async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    
    const { generatePalette } = require('./color-palette');
    const palette = generatePalette(category);
    
    res.json({
      success: true,
      category,
      palette,
      message: `Generated palette for ${category}`
    });
  } catch (error) {
    console.error('❌ Error generating palette:', error);
    res.status(500).json({ 
      error: 'Error generating palette',
      details: error.message 
    });
  }
}));

// Migrate all existing projects to color system
app.post('/api/color-palette/migrate', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Starting color migration for existing projects...');
    
    // Load commit log data
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
      commitLog = JSON.parse(data);
    } else {
      return res.status(404).json({ error: 'No commit log found' });
    }

    // Load category data from weekly plans
    let categoryData = {};
    const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
    if (fs.existsSync(weeklyPlansPath)) {
      const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
      const weeklyPlans = JSON.parse(weeklyPlansData);
      
      if (weeklyPlans.length > 0) {
        const latestPlan = weeklyPlans[weeklyPlans.length - 1];
        categoryData = latestPlan.planData?.userAnswers || {};
      }
    }

    // Extract unique projects from commit log
    const projects = new Set();
    commitLog.forEach(day => {
      Object.keys(day.projects).forEach(projectName => {
        projects.add(projectName);
      });
    });

    // Migrate projects
    let migratedCount = 0;
    let skippedCount = 0;

    for (const projectName of projects) {
      const existingColor = getProjectColor(projectName);
      if (existingColor) {
        skippedCount++;
        continue;
      }

      const projectData = categoryData[projectName];
      const category = projectData?.category || 'Miscellaneous / Standalone';
      
      assignColor(category, projectName);
      migratedCount++;
    }

    const stats = getColorStats();
    
    res.json({
      success: true,
      message: `Color migration completed`,
      stats: {
        migrated: migratedCount,
        skipped: skippedCount,
        total: migratedCount + skippedCount,
        totalProjects: stats.totalProjects,
        totalPalettes: stats.totalPalettes
      }
    });
    
  } catch (error) {
    console.error('❌ Error migrating colors:', error);
    res.status(500).json({ 
      error: 'Error migrating colors',
      details: error.message 
    });
  }
}));

// Get colors for a specific category
app.get('/api/color-palette/category/:category', asyncHandler(async (req, res) => {
  try {
    const { category } = req.params;
    const decodedCategory = decodeURIComponent(category);
    
    // Load color palettes
    const palettesPath = path.join(DATA_DIR, 'color-palettes.json');
    let palettes = {};
    if (fs.existsSync(palettesPath)) {
      const palettesData = fs.readFileSync(palettesPath, 'utf8');
      const data = JSON.parse(palettesData);
      palettes = data.colorPalettes || {};
    }
    
    const categoryPalette = palettes[decodedCategory];
    if (!categoryPalette) {
      return res.json({ success: true, colors: [] });
    }
    
    // Handle both old array format and new object format
    const colors = Array.isArray(categoryPalette) ? categoryPalette : categoryPalette.colors || [];
    res.json({ success: true, colors });
  } catch (error) {
    console.error('❌ Error getting category colors:', error);
    res.status(500).json({ 
      error: 'Error getting category colors',
      details: error.message 
    });
  }
}));

// Update category colors
app.post('/api/color-palette/update-category-colors', asyncHandler(async (req, res) => {
  try {
    const { categoryColors } = req.body;
    
    if (!categoryColors || typeof categoryColors !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid category colors data' });
    }
    
    // Load existing palettes
    const palettesPath = path.join(DATA_DIR, 'color-palettes.json');
    let data = { colorPalettes: {}, projectColors: {}, lastUpdated: new Date().toISOString() };
    if (fs.existsSync(palettesPath)) {
      const palettesData = fs.readFileSync(palettesPath, 'utf8');
      data = JSON.parse(palettesData);
    }
    
    // Update each category's base color and reassign project colors
    const updatedCategories = [];
    Object.entries(categoryColors).forEach(([category, newBaseColor]) => {
      if (data.colorPalettes[category]) {
        // Update the base color and regenerate the palette
        const hsl = hexToHsl(newBaseColor);
        const newPalette = generatePaletteFromHue(hsl.h);
        data.colorPalettes[category] = newPalette;
        data.lastUpdated = new Date().toISOString();
        updatedCategories.push(category);
        
        // Reassign colors to all projects in this category
        // First, we need to find which projects belong to this category
        // We'll do this by checking the weekly planning data
        const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
        let categoryProjects = [];
        
        if (fs.existsSync(weeklyPlansPath)) {
          const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
          const weeklyPlans = JSON.parse(weeklyPlansData);
          
          if (weeklyPlans.length > 0) {
            const latestPlan = weeklyPlans[weeklyPlans.length - 1];
            const userAnswers = latestPlan.planData?.userAnswers || {};
            
            // Find projects that belong to this category
            Object.entries(userAnswers).forEach(([projectName, projectData]) => {
              if (projectData.category === category) {
                categoryProjects.push(projectName);
              }
            });
          }
        }
        
        // Reassign colors to projects in this category
        // Use a more sophisticated algorithm to ensure unique colors
        const usedColors = new Set();
        categoryProjects.forEach((projectName, index) => {
          if (data.projectColors[projectName]) {
            // Find the least used color in the new palette
            let selectedColor = newPalette[0];
            let minUsage = Infinity;
            
            for (const color of newPalette) {
              const usageCount = Array.from(usedColors).filter(hex => hex === color.hex).length;
              if (usageCount < minUsage) {
                minUsage = usageCount;
                selectedColor = color;
              }
            }
            
            // Mark this color as used
            usedColors.add(selectedColor.hex);
            
            // Update the project's color
            data.projectColors[projectName] = {
              ...selectedColor,
              category: category,
              assignedAt: new Date().toISOString()
            };
          }
        });
      }
    });
    
    // Save updated palettes
    fs.writeFileSync(palettesPath, JSON.stringify(data, null, 2));
    
    // Count how many projects were updated
    let updatedProjectsCount = 0;
    updatedCategories.forEach(category => {
      const weeklyPlansPath = path.join(DATA_DIR, 'weekly-plans.json');
      if (fs.existsSync(weeklyPlansPath)) {
        const weeklyPlansData = fs.readFileSync(weeklyPlansPath, 'utf8');
        const weeklyPlans = JSON.parse(weeklyPlansData);
        
        if (weeklyPlans.length > 0) {
          const latestPlan = weeklyPlans[weeklyPlans.length - 1];
          const userAnswers = latestPlan.planData?.userAnswers || {};
          
          Object.entries(userAnswers).forEach(([projectName, projectData]) => {
            if (projectData.category === category && data.projectColors[projectName]) {
              updatedProjectsCount++;
            }
          });
        }
      }
    });
    
    console.log('🎨 Updated category colors:', Object.keys(categoryColors));
    console.log(`🎨 Reassigned colors to ${updatedProjectsCount} projects`);
    
    res.json({ 
      success: true, 
      message: `Category colors updated successfully. ${updatedProjectsCount} projects reassigned new colors.`,
      updatedCategories: updatedCategories,
      updatedProjectsCount: updatedProjectsCount
    });
  } catch (error) {
    console.error('❌ Error updating category colors:', error);
    res.status(500).json({ 
      error: 'Error updating category colors',
      details: error.message 
    });
  }
}));

// Reset all colors to defaults
app.post('/api/color-palette/reset-colors', asyncHandler(async (req, res) => {
  try {
    // Delete the color palettes file to reset to defaults
    const palettesPath = path.join(DATA_DIR, 'color-palettes.json');
    if (fs.existsSync(palettesPath)) {
      fs.unlinkSync(palettesPath);
    }
    
    console.log('🔄 Reset all color palettes to defaults');
    
    res.json({ success: true, message: 'All colors reset to defaults' });
  } catch (error) {
    console.error('❌ Error resetting colors:', error);
    res.status(500).json({ 
      error: 'Error resetting colors',
      details: error.message 
    });
  }
}));



// Link PRD file manually
app.post('/api/prd-stories/link-prd', asyncHandler(async (req, res) => {
  try {
    const { owner, repoName, branch, filePath, prdUrl } = req.body;
    
    if (!owner || !repoName || !branch || !filePath || !prdUrl) {
      return res.status(400).json({ error: 'Missing required fields: owner, repoName, branch, filePath, prdUrl' });
    }
    
    console.log(`🔗 Linking PRD file: ${filePath} in ${owner}/${repoName}`);
    
    // Fetch the PRD content from GitHub
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
        ref: branch
      });
      
      if (response.data.encoding === 'base64') {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        
        // Extract project name from PRD content (look for common patterns)
        let projectName = repoName; // Default to repo name
        
        // Try to find project name in content
        const projectNamePatterns = [
          /^#\s+(.+)$/m,                    // # Project Name
          /^title:\s*(.+)$/im,              // title: Project Name
          /^project:\s*(.+)$/im,            // project: Project Name
          /^name:\s*(.+)$/im,               // name: Project Name
          /^#\s+([^#\n]+?)\s*PRD/im,       // # Project Name PRD
          /^#\s+([^#\n]+?)\s*Requirements/im // # Project Name Requirements
        ];
        
        for (const pattern of projectNamePatterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            projectName = match[1].trim();
            break;
          }
        }
        
        console.log(`📋 Extracted project name: ${projectName}`);
        
        // Extract stories from PRD content
        const stories = extractStoriesFromContent(content, projectName);
        console.log(`📝 Found ${stories.length} stories in PRD`);
        
        // Add stories to Notion
        const { addPrdStoryEntry } = require('./notion');
        let addedCount = 0;
        
        for (const story of stories) {
          try {
            await addPrdStoryEntry({
              projectName: story.projectName,
              storyTitle: story.title,
              status: story.status,
              priority: story.priority,
              storyPoints: story.storyPoints,
              repository: repoName,
              notes: story.notes
            });
            addedCount++;
          } catch (error) {
            console.warn(`⚠️ Failed to add story "${story.title}":`, error.message);
          }
        }
        
        // Store the PRD link
        const prdLinksPath = path.join(__dirname, 'data', 'prd-links.json');
        const dataDir = path.dirname(prdLinksPath);
        
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let prdLinks = [];
        if (fs.existsSync(prdLinksPath)) {
          try {
            const data = fs.readFileSync(prdLinksPath, 'utf8');
            prdLinks = JSON.parse(data);
          } catch (error) {
            console.error('❌ Error reading existing PRD links:', error.message);
          }
        }
        
        // Check if project already exists
        const existingIndex = prdLinks.findIndex(link => link.projectName === projectName);
        if (existingIndex !== -1) {
          prdLinks[existingIndex] = { projectName, owner, repoName, branch, filePath, prdUrl, linkedAt: new Date().toISOString() };
        } else {
          prdLinks.push({ projectName, owner, repoName, branch, filePath, prdUrl, linkedAt: new Date().toISOString() });
        }
        
        // Save the updated links
        fs.writeFileSync(prdLinksPath, JSON.stringify(prdLinks, null, 2));
        
        res.json({
          success: true,
          message: `PRD linked successfully and ${addedCount} stories added to Notion`,
          data: { 
            projectName, 
            owner, 
            repoName, 
            branch, 
            filePath, 
            prdUrl,
            storiesFound: stories.length,
            storiesAdded: addedCount
          }
        });
        
      } else {
        throw new Error('PRD content is not base64 encoded');
      }
      
    } catch (error) {
      console.error('❌ Error fetching PRD content:', error.message);
      res.status(500).json({ 
        error: 'Error fetching PRD content',
        details: error.message 
      });
    }
    
  } catch (error) {
    console.error('❌ Error linking PRD:', error);
    res.status(500).json({ 
      error: 'Error linking PRD',
      details: error.message 
    });
  }
}));

// Wanderlog API endpoints
app.post('/api/wanderlog/process', asyncHandler(async (req, res) => {
  try {
    console.log('🔧 Manual Wanderlog processing triggered via API');
    await runManualProcessing();
    res.json({ 
      success: true, 
      message: 'Wanderlog processing completed successfully' 
    });
  } catch (error) {
    console.error('❌ Error in manual Wanderlog processing:', error);
    res.status(500).json({ 
      error: 'Error processing Wanderlog',
      details: error.message 
    });
  }
}));

// Get all Wanderlog entries
app.get('/api/wanderlog', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching Wanderlog entries...');
    
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    await ensureWanderlogDatabase();
    
    if (!process.env.NOTION_WANDERLOG_DATABASE_ID) {
      return res.status(404).json({ 
        error: 'Wanderlog database not found',
        message: 'Wanderlog database ID not configured' 
      });
    }
    
    const notion = new (require('@notionhq/client')).Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_WANDERLOG_DATABASE_ID,
      sorts: [
        { property: "First Commit Date", direction: "descending" }
      ]
    });
    
    const wanderlogEntries = response.results.map(page => ({
      id: page.id,
      title: page.properties["Title"]?.title?.[0]?.text?.content || "",
      created: page.properties["Created"]?.date?.start || "",
      firstCommitDate: page.properties["First Commit Date"]?.date?.start || "",
      commitCount: page.properties["Commit Count"]?.number || 0,
      projects: page.properties["Projects"]?.rich_text?.[0]?.text?.content || "",
      summary: page.properties["Summary"]?.rich_text?.[0]?.text?.content || "",
      insights: page.properties["Insights"]?.rich_text?.[0]?.text?.content || "",
      focusAreas: page.properties["Focus Areas"]?.rich_text?.[0]?.text?.content || ""
    }));
    
    console.log(`📊 Retrieved ${wanderlogEntries.length} Wanderlog entries`);
    res.json({
      success: true,
      count: wanderlogEntries.length,
      entries: wanderlogEntries
    });
  } catch (error) {
    console.error('❌ Error fetching Wanderlog entries:', error);
    res.status(500).json({ 
      error: 'Error fetching Wanderlog entries',
      details: error.message 
    });
  }
}));

// Get Wanderlog entries for a specific date range
app.get('/api/wanderlog/range', asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both startDate and endDate are required (YYYY-MM-DD format)' 
      });
    }
    
    console.log(`📊 Fetching Wanderlog entries from ${startDate} to ${endDate}...`);
    
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    await ensureWanderlogDatabase();
    
    if (!process.env.NOTION_WANDERLOG_DATABASE_ID) {
      return res.status(404).json({ 
        error: 'Wanderlog database not found',
        message: 'Wanderlog database ID not configured' 
      });
    }
    
    const notion = new (require('@notionhq/client')).Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_WANDERLOG_DATABASE_ID,
      filter: {
        and: [
          {
            property: "First Commit Date",
            date: {
              greater_than_or_equal_to: startDate
            }
          },
          {
            property: "First Commit Date",
            date: {
              less_than_or_equal_to: endDate
            }
          }
        ]
      },
      sorts: [
        { property: "First Commit Date", direction: "descending" }
      ]
    });
    
    const wanderlogEntries = response.results.map(page => ({
      id: page.id,
      title: page.properties["Title"]?.title?.[0]?.text?.content || "",
      created: page.properties["Created"]?.date?.start || "",
      firstCommitDate: page.properties["First Commit Date"]?.date?.start || "",
      commitCount: page.properties["Commit Count"]?.number || 0,
      projects: page.properties["Projects"]?.rich_text?.[0]?.text?.content || "",
      summary: page.properties["Summary"]?.rich_text?.[0]?.text?.content || "",
      insights: page.properties["Insights"]?.rich_text?.[0]?.text?.content || "",
      focusAreas: page.properties["Focus Areas"]?.rich_text?.[0]?.text?.content || ""
    }));
    
    console.log(`📊 Retrieved ${wanderlogEntries.length} Wanderlog entries for date range`);
    res.json({
      success: true,
      count: wanderlogEntries.length,
      startDate,
      endDate,
      entries: wanderlogEntries
    });
  } catch (error) {
    console.error('❌ Error fetching Wanderlog entries by date range:', error);
    res.status(500).json({ 
      error: 'Error fetching Wanderlog entries by date range',
      details: error.message 
    });
  }
}));

// Get Wanderlog entry for a specific date
app.get('/api/wanderlog/date/:date', asyncHandler(async (req, res) => {
  try {
    const { date } = req.params;
    
    console.log(`📊 Fetching Wanderlog entry for date: ${date}...`);
    
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    await ensureWanderlogDatabase();
    
    if (!process.env.NOTION_WANDERLOG_DATABASE_ID) {
      return res.status(404).json({ 
        error: 'Wanderlog database not found',
        message: 'Wanderlog database ID not configured' 
      });
    }
    
    const notion = new (require('@notionhq/client')).Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_WANDERLOG_DATABASE_ID,
      filter: {
        property: "First Commit Date",
        date: {
          equals: date
        }
      }
    });
    
    if (response.results.length === 0) {
      return res.status(404).json({ 
        error: 'Wanderlog entry not found',
        message: `No Wanderlog entry found for date: ${date}` 
      });
    }
    
    const entry = response.results[0];
    const wanderlogEntry = {
      id: entry.id,
      title: entry.properties["Title"]?.title?.[0]?.text?.content || "",
      created: entry.properties["Created"]?.date?.start || "",
      firstCommitDate: entry.properties["First Commit Date"]?.date?.start || "",
      commitCount: entry.properties["Commit Count"]?.number || 0,
      projects: entry.properties["Projects"]?.rich_text?.[0]?.text?.content || "",
      summary: entry.properties["Summary"]?.rich_text?.[0]?.text?.content || "",
      insights: entry.properties["Insights"]?.rich_text?.[0]?.text?.content || "",
      focusAreas: entry.properties["Focus Areas"]?.rich_text?.[0]?.text?.content || ""
    };
    
    console.log(`📊 Retrieved Wanderlog entry for ${date}`);
    res.json({
      success: true,
      entry: wanderlogEntry
    });
  } catch (error) {
    console.error('❌ Error fetching Wanderlog entry by date:', error);
    res.status(500).json({ 
      error: 'Error fetching Wanderlog entry by date',
      details: error.message 
    });
  }
}));

// Get Wanderlog statistics
app.get('/api/wanderlog/stats', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching Wanderlog statistics...');
    
    const { ensureWanderlogDatabase } = require('./wanderlog-processor');
    await ensureWanderlogDatabase();
    
    if (!process.env.NOTION_WANDERLOG_DATABASE_ID) {
      return res.status(404).json({ 
        error: 'Wanderlog database not found',
        message: 'Wanderlog database ID not configured' 
      });
    }
    
    const notion = new (require('@notionhq/client')).Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_WANDERLOG_DATABASE_ID,
      sorts: [
        { property: "First Commit Date", direction: "descending" }
      ]
    });
    
    const entries = response.results.map(page => ({
      created: page.properties["Created"]?.date?.start || "",
      firstCommitDate: page.properties["First Commit Date"]?.date?.start || "",
      commitCount: page.properties["Commit Count"]?.number || 0,
      projects: page.properties["Projects"]?.rich_text?.[0]?.text?.content || "",
      focusAreas: page.properties["Focus Areas"]?.rich_text?.[0]?.text?.content || ""
    }));
    
    // Calculate statistics
    const totalEntries = entries.length;
    const totalCommits = entries.reduce((sum, entry) => sum + entry.commitCount, 0);
    const avgCommitsPerDay = totalEntries > 0 ? Math.round(totalCommits / totalEntries) : 0;
    
    // Get unique projects
    const allProjects = entries.flatMap(entry => 
      entry.projects ? entry.projects.split(', ').map(p => p.trim()) : []
    );
    const uniqueProjects = [...new Set(allProjects)].filter(p => p.length > 0);
    
    // Get focus areas
    const allFocusAreas = entries.flatMap(entry => 
      entry.focusAreas ? entry.focusAreas.split(', ').map(f => f.trim()) : []
    );
    const focusAreaCounts = allFocusAreas.reduce((acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {});
    const topFocusAreas = Object.entries(focusAreaCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([area, count]) => ({ area, count }));
    
    // Get date range (using first commit dates)
    const firstCommitDates = entries.map(e => e.firstCommitDate).filter(d => d).sort();
    const dateRange = firstCommitDates.length > 0 ? {
      earliest: firstCommitDates[0],
      latest: firstCommitDates[firstCommitDates.length - 1]
    } : null;
    
    const stats = {
      totalEntries,
      totalCommits,
      avgCommitsPerDay,
      uniqueProjects: uniqueProjects.length,
      projects: uniqueProjects,
      topFocusAreas,
      dateRange
    };
    
    console.log(`📊 Calculated Wanderlog statistics: ${totalEntries} entries, ${totalCommits} total commits`);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching Wanderlog statistics:', error);
    res.status(500).json({ 
      error: 'Error fetching Wanderlog statistics',
      details: error.message 
    });
  }
}));

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
  console.log(`🗄️ Notion commit database ID configured: ${process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID ? 'Yes' : 'No'}`);
  console.log(`🤖 OpenAI API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🐙 GitHub token configured: ${process.env.GITHUB_TOKEN ? 'Yes' : 'No'}`);
  
  // Start Wanderlog daily processing
  scheduleDailyProcessing();
});

// Add server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

