// Backfill rate limiting configuration
const BACKFILL_LIMITS = {
  perHour: 10,    // Max 10 backfill requests per hour
  perDay: 50,     // Max 50 backfill requests per day
  cooldown: 5000  // 5 second cooldown between requests
};

// Track backfill attempts per API key
const backfillAttempts = new Map();

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
  
  return { authenticated: true, apiKey };
}

// Record a backfill attempt
function recordBackfillAttempt(apiKey) {
  const now = Date.now();
  
  if (!backfillAttempts.has(apiKey)) {
    backfillAttempts.set(apiKey, []);
  }
  
  const attempts = backfillAttempts.get(apiKey);
  attempts.push(now);
  backfillAttempts.set(apiKey, attempts);
}

module.exports = {
  checkBackfillRateLimit,
  validateBackfillDate,
  authenticateBackfillKey,
  recordBackfillAttempt,
  BACKFILL_LIMITS
};
