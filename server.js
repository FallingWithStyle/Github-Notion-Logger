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
const LlamaHubService = require('./services/llama-hub-service');

// Import route modules
const apiRoutes = require('./routes');
const aiChatRoutes = require('./routes/ai-chat');

// Import server services
const serverServices = require('./services/server');

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

// Mount API routes
app.use('/api', apiRoutes);
app.use('/api/v2/ai', aiChatRoutes);

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

// API route moved to routes/ directory
// API route moved to routes/ directory
// API route moved to routes/ directory

// API endpoint to save weekly plan
// API route moved to routes/ directory

// API endpoint to get weekly plans
// API route moved to routes/ directory

// API endpoint to sync weekly plan to Notion
// API route moved to routes/ directory

// Use user migration service
const { migrateOldUserAnswers } = serverServices;

// Use project processing service
const { 
  extractStoriesFromContent, 
  storeProjectProgressInNotion, 
  storeStoriesInNotion, 
  ensureProjectProgressDatabase, 
  ensureStoryProgressDatabase 
} = serverServices;

// API endpoint to get weekly planning data from Notion
// API route moved to routes/ directory

// Timezone configuration endpoints
// API route moved to routes/ directory
// API route moved to routes/ directory
// API route moved to routes/ directory

// Cache for project progress data
const progressCache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// New optimized PRD and task-list processing endpoints
// API route moved to routes/ directory

// Get project progress with detailed breakdown
// API route moved to routes/ directory

// Clear progress cache
// API route moved to routes/ directory

// Clear scan cache
// API route moved to routes/ directory

// Get repositories list (simple, no file processing)
// API route moved to routes/ directory

// Process specific repository for PRD and task-list files
// API route moved to routes/ directory

// Ignore repository
// API route moved to routes/ directory

// Get ignored repositories
// API route moved to routes/ directory

// Unignore repository
// API route moved to routes/ directory

// Add new PRD story
// API route moved to routes/ directory

// Update existing PRD story
// API route moved to routes/ directory



// Helper function to extract stories from PRD content - REMOVED (duplicate of imported function)

// Store project progress in Notion - REMOVED (duplicate of imported function)

// Store individual stories in Notion - REMOVED (duplicate of imported function)
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
// API route moved to routes/ directory

// GET /api/commits/{date} - Get commits for specific date
// API route moved to routes/ directory

// GET /api/commits/summary/{date} - Get daily summary for specific date
// API route moved to routes/ directory

// POST /api/commits/backfill - Dedicated backfill endpoint
// API route moved to routes/ directory

// ============================================================================
// EXISTING API ENDPOINTS
// ============================================================================

// Projects API endpoint for external consumption (e.g., Wanderjob)
// API route moved to routes/ directory

// Color palette management endpoints
// API route moved to routes/ directory

// Get color for specific project
// API route moved to routes/ directory

// Update project color
// API route moved to routes/ directory

// Generate palette for category
// API route moved to routes/ directory

// Migrate all existing projects to color system
// API route moved to routes/ directory

// Get colors for a specific category
// API route moved to routes/ directory

// Update category colors
// API route moved to routes/ directory

// Reset all colors to defaults
// API route moved to routes/ directory



// Link PRD file manually
// API route moved to routes/ directory

// Wanderlog API endpoints
// API route moved to routes/ directory

// Get all Wanderlog entries
// API route moved to routes/ directory

// Get Wanderlog entries for a specific date range
// API route moved to routes/ directory

// Get Wanderlog entry for a specific date
// API route moved to routes/ directory

// Get Wanderlog statistics
// API route moved to routes/ directory

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
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

// ============================================================================
// EPIC 9: NEW API ENDPOINTS FOR PROJECTS AND PROGRESS VIEW REDESIGN
// ============================================================================

// Import services
const ProjectManagementService = require('./services/project-management-service');
const ProgressTrackingService = require('./services/progress-tracking-service');

// Initialize services
const projectManagementService = new ProjectManagementService();
const progressTrackingService = new ProgressTrackingService();

// ============================================================================
// PROJECT OVERVIEW API ENDPOINTS
// ============================================================================

// Get project overview with health indicators
// API route moved to routes/ directory

// Get project health status
// API route moved to routes/ directory

// Get project categories
// API route moved to routes/ directory

// Search projects
// API route moved to routes/ directory

// ============================================================================
// PROGRESS TRACKING API ENDPOINTS
// ============================================================================

// Get progress analytics
// API route moved to routes/ directory

// Get incomplete work tracking
// API route moved to routes/ directory

// Get velocity trends
// API route moved to routes/ directory

// Get blocked and stale items
// API route moved to routes/ directory

// ============================================================================
// CACHE MANAGEMENT ENDPOINTS
// ============================================================================

// Clear project management cache
// API route moved to routes/ directory

// Clear progress tracking cache
// API route moved to routes/ directory

// Get cache status
// API route moved to routes/ directory

// Get performance statistics
// API route moved to routes/ directory

// Clear all performance caches
// API route moved to routes/ directory

// ============================================================================
// LLAMA-HUB API ENDPOINTS
// ============================================================================

// Health check for Llama-hub
// API route moved to routes/ directory

// Get available models
// API route moved to routes/ directory

// Chat completion endpoint
// API route moved to routes/ directory

// Generate text endpoint
// API route moved to routes/ directory

// Project analysis endpoint
// API route moved to routes/ directory

// Commit message suggestion endpoint
// API route moved to routes/ directory

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Webhook secret configured: ${process.env.GITHUB_WEBHOOK_SECRET ? 'Yes' : 'No'}`);
  console.log(`📝 Notion API key configured: ${process.env.NOTION_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🗄️ Notion commit database ID configured: ${process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID ? 'Yes' : 'No'}`);
  console.log(`🤖 OpenAI API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🐙 GitHub token configured: ${process.env.GITHUB_TOKEN ? 'Yes' : 'No'}`);
  console.log(`🦙 Llama-hub URL configured: ${process.env.LLAMA_HUB_URL || 'http://localhost:9000'}`);
  console.log(`🔑 Llama-hub API key configured: ${process.env.LLAMA_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🤖 Default Llama model: ${process.env.LLAMA_DEFAULT_MODEL || 'llama3-7b'}`);
  
  // Start Wanderlog daily processing
  scheduleDailyProcessing();
});

// Add server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Handle 404 errors (must be last)
app.use((req, res) => {
  console.log(`❌ 404 - ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

