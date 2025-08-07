const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const { logCommitsToNotion } = require('./notion');

dotenv.config();
const app = express();
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

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
    await logCommitsToNotion(commits, repo);
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging to Notion');
  }
});

// Serve the commit visualizer page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));
