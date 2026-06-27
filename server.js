const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const timeout = require('connect-timeout');

dotenv.config();

const SERVICE_NAME = 'GitHub Activity Logger';
const SERVICE_VERSION = '2.0.0';

const app = express();

app.use(timeout('30s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
  limit: '10mb'
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path} - Started`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📤 ${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

const { initDb, seedProjectsFromConfig, closeDb, getDbPath } = require('./db/store');
initDb();
seedProjectsFromConfig();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: SERVICE_VERSION });
});

const webhookRoutes = require('./routes/webhook');
app.use('/', webhookRoutes);

const staticRoutes = require('./routes/static');
app.use('/', staticRoutes);

const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

app.use((req, res) => {
  console.log(`❌ 404 - ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 3040;

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 ${SERVICE_NAME} v${SERVICE_VERSION} listening on http://${HOST}:${PORT}`);
  if (PORT === 8080) {
    console.warn('⚠️  PORT=8080 is legacy v1 — v2 default is 3040 (pm2 ecosystem sets this automatically)');
  }
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Webhook secret configured: ${process.env.GITHUB_WEBHOOK_SECRET ? 'Yes' : 'No'}`);
  console.log(`🐙 GitHub token configured: ${process.env.GITHUB_TOKEN ? 'Yes' : 'No'}`);
  console.log(`📝 Notion sync: ${process.env.NOTION_SYNC === 'true' ? 'enabled (legacy)' : 'disabled'}`);
  console.log(`🗄️  SQLite: ${getDbPath()}`);
});

server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

function shutdown(signal) {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
