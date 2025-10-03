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
 * Generate contextual response when AI service is unavailable
 */
function generateContextualResponse(message, contextType, context) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('focus') || lowerMessage.includes('priority') || lowerMessage.includes('urgent')) {
    return `Based on your project data, here are some focus areas to consider:

📊 **Project Status Overview:**
- Active projects: ${context.projects?.length || 0}
- Recent activity: ${context.recentActivity || 'No recent activity'}
- Pending tasks: ${context.pendingTasks || 'No pending tasks'}

🎯 **Suggested Focus Areas:**
1. Review and prioritize pending tasks
2. Check for any overdue items
3. Plan upcoming milestones
4. Address any blockers or issues

💡 **Quick Actions:**
- Check your project dashboard for updates
- Review recent commits and pull requests
- Update project status and timelines

*Note: AI analysis is temporarily unavailable, but you can still access your project data through the dashboard.*`;
  }
  
  if (lowerMessage.includes('quick') || lowerMessage.includes('easy') || lowerMessage.includes('win')) {
    return `Here are some quick wins you can tackle:

⚡ **Quick Wins Available:**
- Review and merge pending pull requests
- Update project documentation
- Clean up old branches
- Review and close resolved issues

📈 **Low-effort, High-impact Tasks:**
- Update project README files
- Add missing tests
- Refactor small code sections
- Update dependencies

*Note: AI analysis is temporarily unavailable, but you can still access your project data through the dashboard.*`;
  }
  
  if (lowerMessage.includes('project') || lowerMessage.includes('repository')) {
    return `Here's your project overview:

📁 **Project Portfolio:**
- Total projects: ${context.projects?.length || 0}
- Active projects: ${context.activeProjects || 'Unknown'}
- Recent updates: ${context.recentUpdates || 'No recent updates'}

🔍 **Project Details:**
- Languages: ${context.languages?.join(', ') || 'Unknown'}
- Last activity: ${context.lastActivity || 'Unknown'}
- Contributors: ${context.contributors || 'Unknown'}

*Note: AI analysis is temporarily unavailable, but you can still access your project data through the dashboard.*`;
  }
  
  // Default response
  return `I can help you with project management and analysis. Here's what I can see:

📊 **Available Data:**
- Projects: ${context.projects?.length || 0}
- Context type: ${contextType}
- Data freshness: ${context.dataFreshness || 'Unknown'}

💡 **What I can help with:**
- Project analysis and recommendations
- Quick wins identification
- Focus area suggestions
- Progress tracking and insights

*Note: AI analysis is temporarily unavailable, but you can still access your project data through the dashboard.*`;
}

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
    let responseContent = 'No response generated';
    
    try {
      const aiResponse = await llamaHubService.chatCompletion({
        messages,
        maxTokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        stream: false
      });

      responseContent = aiResponse.choices?.[0]?.message?.content || 'No response generated';
    } catch (aiError) {
      console.error('AI service error:', aiError);
      // Provide helpful context-based response when AI is unavailable
      responseContent = generateContextualResponse(message, contextType, context);
    }

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
