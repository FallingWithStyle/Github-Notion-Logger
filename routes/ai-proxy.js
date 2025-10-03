const express = require('express');
const { asyncHandler } = require('../services/server');
const AIContextService = require('../services/ai-context-service');
const AISessionService = require('../services/ai-session-service');
const AIResponseValidator = require('../services/ai-response-validator');
const LlamaHubService = require('../services/llama-hub-service');
const { circuitBreakerManager } = require('../services/ai-circuit-breaker');

const router = express.Router();

// GNL Assistant configuration
const GNL_ASSISTANT_URL = process.env.GNL_ASSISTANT_URL || 'http://localhost:4250';
const LOCAL_ASSISTANT_TIMEOUT = 30000; // 30 seconds

// Initialize services for fallback
const aiContextService = new AIContextService();
const aiSessionService = new AISessionService();
const aiResponseValidator = new AIResponseValidator();
const llamaHubService = new LlamaHubService();

/**
 * Fallback AI service when GNL Assistant is not available
 */
async function fallbackAIService(req, res) {
  try {
    const { message, sessionId, contextType, options = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get context based on type
    let context = {};
    const contextStart = Date.now();
    
    try {
      switch (contextType) {
        case 'project':
          context = await aiContextService.getProjectContext({ projectFilter: options.projectFilter });
          break;
        case 'quickWins':
          context = await aiContextService.getQuickWinsContext({});
          break;
        case 'focusAreas':
          context = await aiContextService.getFocusAreasContext({});
          break;
        case 'portfolio':
        default:
          context = await aiContextService.getPortfolioContext({});
          break;
      }
    } catch (contextError) {
      console.error('Context retrieval failed:', contextError);
      context = { error: 'Context unavailable' };
    }
    
    const contextTime = Date.now() - contextStart;

    // Get session
    let session = aiSessionService.getSession(sessionId);
    if (!session) {
      session = aiSessionService.createSession(sessionId);
    }

    // Add user message
    aiSessionService.addMessage(sessionId, 'user', message);

    // Prepare messages for AI
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for project management. Context: ${JSON.stringify(context)}`
      },
      ...session.messages.slice(-10) // Last 10 messages for context
    ];

    // Generate AI response
    const aiResponse = await llamaHubService.chatCompletion({
      messages,
      maxTokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      stream: false
    });

    const responseContent = aiResponse.choices?.[0]?.message?.content || 'No response generated';

    // Validate response
    const validation = aiResponseValidator.validateResponse({
      content: responseContent,
      response: responseContent,
      text: responseContent
    }, context, contextType);

    // Add AI response to session
    aiSessionService.addMessage(sessionId, 'assistant', responseContent);

    return res.json({
      success: true,
      response: responseContent,
      sessionId,
      context: {
        type: contextType,
        dataSize: JSON.stringify(context).length
      },
      validation: validation
    });

  } catch (error) {
    console.error('Fallback AI service error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI service temporarily unavailable',
      details: error.message
    });
  }
}

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
    console.log('🔄 Falling back to local AI service...');
    
    // Fallback to local AI service when GNL Assistant is unavailable
    return fallbackAIService(req, res);
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
    console.log('🔄 Falling back to local AI service...');
    
    // Fallback to local AI service when GNL Assistant is unavailable
    return fallbackAIService(req, res);
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
    console.log('🔄 Falling back to local AI service...');
    
    // Fallback to local AI service when GNL Assistant is unavailable
    return fallbackAIService(req, res);
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
