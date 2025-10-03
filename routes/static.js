const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Define data directory and commit log path
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');

// Server-Sent Events clients set
const sseClients = new Set();

// Server-Sent Events endpoint for real-time updates
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  // Send initial connection event
  res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');

  // Keep connection alive with periodic heartbeat
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
router.get('/commit-log.json', (req, res) => {
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

// Serve static files from public directory
router.use(express.static(path.join(__dirname, '../public')));

// Serve the main pages
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

router.get('/week', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'week.html'));
});

router.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'projects.html'));
});

router.get('/progress', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'progress.html'));
});

module.exports = router;
