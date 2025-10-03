const express = require('express');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// GNL Assistant configuration
const GNL_ASSISTANT_URL = process.env.GNL_ASSISTANT_URL || 'http://localhost:4250';
const LOCAL_ASSISTANT_TIMEOUT = 30000; // 30 seconds

/**
 * Proxy AI chat requests to GNL Assistant
 * POST /api/v2/ai/chat
 */
router.post('/chat', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Proxying AI chat request to GNL Assistant');
    
    const response = await fetch(`${GNL_ASSISTANT_URL}/api/gnl/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(LOCAL_ASSISTANT_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`GNL Assistant error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ Error proxying to GNL Assistant:', error);
    
    // Fallback response when GNL Assistant is unavailable
    res.status(503).json({
      success: false,
      error: 'AI Assistant temporarily unavailable',
      details: 'GNL Assistant is not running. Please start the GNL Assistant server.',
      fallback: true
    });
  }
}));

/**
 * Proxy AI recommendations requests to GNL Assistant
 * POST /api/v2/ai/recommendations
 */
router.post('/recommendations', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Proxying AI recommendations request to GNL Assistant');
    
    const response = await fetch(`${GNL_ASSISTANT_URL}/api/gnl/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisType: 'quickWins',
        ...req.body
      }),
      signal: AbortSignal.timeout(LOCAL_ASSISTANT_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`GNL Assistant error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ Error proxying recommendations to GNL Assistant:', error);
    
    // Fallback response when GNL Assistant is unavailable
    res.status(503).json({
      success: false,
      error: 'AI Recommendations temporarily unavailable',
      details: 'GNL Assistant is not running. Please start the GNL Assistant server.',
      fallback: true
    });
  }
}));

/**
 * Proxy AI analyze requests to GNL Assistant
 * POST /api/v2/ai/analyze
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  try {
    console.log('🔄 Proxying AI analyze request to GNL Assistant');
    
    const response = await fetch(`${GNL_ASSISTANT_URL}/api/gnl/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(LOCAL_ASSISTANT_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`GNL Assistant error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ Error proxying analyze to GNL Assistant:', error);
    
    // Fallback response when GNL Assistant is unavailable
    res.status(503).json({
      success: false,
      error: 'AI Analysis temporarily unavailable',
      details: 'GNL Assistant is not running. Please start the GNL Assistant server.',
      fallback: true
    });
  }
}));

/**
 * Health check for GNL Assistant connection
 * GET /api/v2/ai/health
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const response = await fetch(`${GNL_ASSISTANT_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout for health check
    });

    if (!response.ok) {
      throw new Error(`GNL Assistant health check failed: ${response.status}`);
    }

    const data = await response.json();
    res.json({
      success: true,
      gnlAssistant: data,
      proxy: {
        status: 'connected',
        url: GNL_ASSISTANT_URL
      }
    });

  } catch (error) {
    console.error('❌ GNL Assistant health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'GNL Assistant unavailable',
      details: error.message,
      proxy: {
        status: 'disconnected',
        url: GNL_ASSISTANT_URL
      }
    });
  }
}));

module.exports = router;
