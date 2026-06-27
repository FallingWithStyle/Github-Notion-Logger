const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data'));
const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');

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

router.use(express.static(path.join(__dirname, '../public')));

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = router;
