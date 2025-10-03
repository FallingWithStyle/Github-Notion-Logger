#!/usr/bin/env node

/**
 * GNL Assistant Server (Port 4250)
 * 
 * This is a specialized instance of the local assistant
 * configured for the GitHub Notion Logger project.
 * 
 * Features:
 * - Optimized for GNL project data
 * - Enhanced performance monitoring
 * - Project-specific context handling
 * - Advanced caching and optimization
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import AI services
const AIContextService = require('./services/ai-context-service');
const AISessionService = require('./services/ai-session-service');
const AIResponseValidator = require('./services/ai-response-validator');
const LlamaHubService = require('./services/llama-hub-service');

const app = express();
const PORT = process.env.GNL_ASSISTANT_PORT || 4250;
const FLY_IO_BASE_URL = process.env.FLY_IO_BASE_URL || 'https://notion-logger.fly.dev';

// Enhanced middleware for GNL
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(bodyParser.json({ 
  limit: '50mb', // Increased for large project data
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced request logging for GNL
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  
  console.log(`🚀 [GNL Assistant] ${new Date().toISOString()} - ${req.method} ${req.path} - [${requestId}] - Started`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`${status} [GNL Assistant] ${new Date().toISOString()} - ${req.method} ${req.path} - [${requestId}] - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Initialize AI services with GNL-specific configuration
const aiContextService = new AIContextService();
const aiSessionService = new AISessionService();
const aiResponseValidator = new AIResponseValidator();
const llamaHubService = new LlamaHubService();

// GNL-specific performance monitoring
const gnlMetrics = {
  requests: 0,
  totalTime: 0,
  contextTime: 0,
  aiTime: 0,
  validationTime: 0,
  errors: 0,
  cacheHits: 0,
  flyIOCalls: 0,
  projectQueries: 0,
  portfolioQueries: 0,
  quickWinsQueries: 0,
  focusAreasQueries: 0,
  startTime: Date.now(),
  sessions: new Map()
};

// GNL-specific optimization settings
const GNL_CONFIG = {
  maxConcurrentRequests: 10, // Higher for GNL
  requestTimeout: 45000, // Longer timeout for complex queries
  contextCacheTimeout: 300000, // 5 minutes for GNL data
  sessionCleanupInterval: 600000, // 10 minutes
  maxContextSize: 50 * 1024 * 1024, // 50MB for large project data
  enableCompression: true,
  enableCaching: true,
  enableProjectCaching: true,
  maxSessions: 1000,
  sessionTimeout: 1800000 // 30 minutes
};

// Request queue for concurrency control
const requestQueue = [];
let activeRequests = 0;

/**
 * Enhanced Fly.io data fetching with GNL optimizations
 */
async function fetchFromFlyIO(endpoint, options = {}) {
  try {
    const url = `${FLY_IO_BASE_URL}${endpoint}`;
    console.log(`📡 [GNL] Fetching from Fly.io: ${url}`);
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GNL-Assistant/1.0',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      timeout: GNL_CONFIG.requestTimeout
    });

    if (!response.ok) {
      throw new Error(`Fly.io request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    gnlMetrics.flyIOCalls++;
    return data;
  } catch (error) {
    console.error(`❌ [GNL] Error fetching from Fly.io ${endpoint}:`, error);
    throw error;
  }
}

/**
 * GNL-specific concurrency control
 */
async function processWithGNLConcurrencyControl(handler) {
  return new Promise((resolve, reject) => {
    const processRequest = async () => {
      if (activeRequests >= GNL_CONFIG.maxConcurrentRequests) {
        requestQueue.push({ handler, resolve, reject });
        return;
      }

      activeRequests++;
      try {
        const result = await handler();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          setImmediate(() => processRequest());
        }
      }
    };

    processRequest();
  });
}

/**
 * GNL Project Chat API
 * POST /api/gnl/chat
 */
app.post('/api/gnl/chat', async (req, res) => {
  const startTime = Date.now();
  let success = true;
  
  // Update metrics
  gnlMetrics.requests++;
  
  try {
    const result = await processWithGNLConcurrencyControl(async () => {
      const { 
        message, 
        sessionId, 
        contextType = 'general', 
        projectFilter, 
        options = {} 
      } = req.body;

      // Validate required fields
      if (!message) {
        throw new Error('Message is required');
      }

      console.log(`🤖 [GNL] AI Chat request: ${message.substring(0, 50)}...`);

      // Get or create session with GNL-specific settings
      let session = aiSessionService.getSession(sessionId);
      if (!session) {
        session = aiSessionService.createSession(sessionId);
        gnlMetrics.sessions.set(sessionId, {
          created: Date.now(),
          requests: 0,
          lastActivity: Date.now()
        });
        console.log(`✨ [GNL] Created new AI session: ${sessionId}`);
      }

      // Update session metrics
      const sessionMetrics = gnlMetrics.sessions.get(sessionId);
      if (sessionMetrics) {
        sessionMetrics.requests++;
        sessionMetrics.lastActivity = Date.now();
      }

      // Add user message to session
      aiSessionService.addMessage(sessionId, 'user', message, {
        contextType,
        projectFilter,
        timestamp: new Date().toISOString(),
        gnlRequest: true
      });

      // Get context based on type with GNL optimizations
      let context = {};
      let contextStartTime = Date.now();
      
      try {
        switch (contextType) {
          case 'project':
            if (projectFilter) {
              gnlMetrics.projectQueries++;
              const projectData = await fetchFromFlyIO(`/api/v2/projects/${encodeURIComponent(projectFilter)}/health`);
              context = await aiContextService.getProjectContext(projectFilter, contextType);
            }
            break;
          
          case 'portfolio':
            gnlMetrics.portfolioQueries++;
            const portfolioData = await fetchFromFlyIO('/api/v2/projects/overview', {
              method: 'GET'
            });
            context = await aiContextService.getPortfolioContext({});
            break;
          
          case 'quickWins':
            gnlMetrics.quickWinsQueries++;
            context = await aiContextService.getQuickWinsContext({});
            break;
          
          case 'focusAreas':
            gnlMetrics.focusAreasQueries++;
            context = await aiContextService.getFocusAreasContext({});
            break;
          
          case 'planning':
            const planningData = await fetchFromFlyIO('/api/v2/progress/analytics');
            context = await aiContextService.getPlanningContext({});
            break;
          
          case 'productivity':
            context = await aiContextService.getProductivityContext({});
            break;
          
          case 'quality':
            context = await aiContextService.getQualityContext({});
            break;
          
          default:
            gnlMetrics.portfolioQueries++;
            context = await aiContextService.getPortfolioContext({});
        }
        
        gnlMetrics.flyIOCalls++;
      } catch (contextError) {
        console.warn(`⚠️ [GNL] Context retrieval failed: ${contextError.message}`);
        // Continue without context rather than failing completely
      }

      const contextTime = Date.now() - contextStartTime;
      gnlMetrics.contextTime += contextTime;

      // Get conversation history
      const history = aiSessionService.getHistory(sessionId, options.includeHistory !== false ? 15 : 0);
      
      // Build messages for AI with GNL-specific system prompt
      const messages = [
        {
          role: 'system',
          content: getGNLSystemPrompt(contextType, context)
        },
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // Generate AI response
      const aiStartTime = Date.now();
      let aiResponse;
      let responseContent = 'No response generated';
      
      try {
        aiResponse = await llamaHubService.chatCompletion({
          messages,
          maxTokens: options.maxTokens || 1500, // Higher for GNL
          temperature: options.temperature || 0.7,
          stream: false
        });
        
        responseContent = aiResponse.choices?.[0]?.message?.content || 'No response generated';
      } catch (aiError) {
        console.error('❌ [GNL] AI service failed:', aiError);
        responseContent = 'I apologize, but I\'m experiencing technical difficulties with the GNL Assistant. Please try again in a moment.';
        gnlMetrics.errors++;
      }

      const aiTime = Date.now() - aiStartTime;
      gnlMetrics.aiTime += aiTime;

      // Validate response
      const validationStart = Date.now();
      const validation = aiResponseValidator.validateResponse(responseContent, context, contextType);
      const validationTime = Date.now() - validationStart;
      gnlMetrics.validationTime += validationTime;

      // Add AI response to session
      aiSessionService.addMessage(sessionId, 'assistant', responseContent, {
        contextType,
        projectFilter,
        timestamp: new Date().toISOString(),
        gnlRequest: true,
        metadata: {
          contextTime,
          aiTime,
          validationTime,
          validation: validation
        }
      });

      const totalTime = Date.now() - startTime;
      gnlMetrics.totalTime += totalTime;

      console.log(`✅ [GNL] AI Chat completed in ${totalTime}ms (context: ${contextTime}ms, AI: ${aiTime}ms, validation: ${validationTime}ms)`);

      return {
        success: true,
        response: responseContent,
        sessionId,
        context: {
          type: contextType,
          projectFilter,
          dataSize: JSON.stringify(context).length
        },
        performance: {
          totalTime,
          contextTime,
          aiTime,
          validationTime
        },
        validation: validation,
        gnl: {
          requestId: req.requestId,
          sessionMetrics: sessionMetrics
        }
      };
    });

    res.json(result);

  } catch (error) {
    console.error('❌ [GNL] Error in AI chat:', error);
    gnlMetrics.errors++;
    
    if (error.message === 'Message is required') {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

/**
 * GNL Project Analysis API
 * POST /api/gnl/analyze
 */
app.post('/api/gnl/analyze', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      analysisType, 
      filters = {}, 
      options = {} 
    } = req.body;

    if (!analysisType) {
      return res.status(400).json({
        success: false,
        error: 'Analysis type is required',
        validTypes: ['focusAreas', 'quickWins', 'health', 'productivity', 'planning', 'portfolio']
      });
    }

    console.log(`🔍 [GNL] Performing ${analysisType} analysis`);

    // Get context from Fly.io with GNL optimizations
    let context;
    try {
      switch (analysisType) {
        case 'focusAreas':
          gnlMetrics.focusAreasQueries++;
          context = await aiContextService.getFocusAreasContext(filters);
          break;
        case 'quickWins':
          gnlMetrics.quickWinsQueries++;
          context = await aiContextService.getQuickWinsContext(filters);
          break;
        case 'health':
          context = await aiContextService.getHealthContext(filters);
          break;
        case 'portfolio':
          gnlMetrics.portfolioQueries++;
          context = await aiContextService.getPortfolioContext(filters);
          break;
        default:
          context = await aiContextService.getPortfolioContext(filters);
      }
    } catch (contextError) {
      console.warn(`⚠️ [GNL] Context retrieval failed: ${contextError.message}`);
      context = { analysis: {} };
    }

    // Generate GNL-specific analysis
    const analysis = generateGNLAnalysis(analysisType, context, options);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [GNL] Generated ${analysisType} analysis in ${duration}ms`);

    res.json({
      success: true,
      analysis,
      context: {
        type: analysisType,
        filters,
        dataSize: JSON.stringify(context).length
      },
      performance: {
        duration
      },
      gnl: {
        requestId: req.requestId,
        analysisType
      }
    });

  } catch (error) {
    console.error('❌ [GNL] Error generating analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analysis',
      details: error.message
    });
  }
});

/**
 * GNL Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'gnl-assistant',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    flyIOConnection: FLY_IO_BASE_URL,
    uptime: Date.now() - gnlMetrics.startTime,
    activeRequests,
    queuedRequests: requestQueue.length,
    activeSessions: gnlMetrics.sessions.size
  });
});

/**
 * GNL Performance metrics endpoint
 */
app.get('/metrics', (req, res) => {
  const uptime = Date.now() - gnlMetrics.startTime;
  const avgResponseTime = gnlMetrics.requests > 0 ? gnlMetrics.totalTime / gnlMetrics.requests : 0;
  const avgContextTime = gnlMetrics.requests > 0 ? gnlMetrics.contextTime / gnlMetrics.requests : 0;
  const avgAiTime = gnlMetrics.requests > 0 ? gnlMetrics.aiTime / gnlMetrics.requests : 0;
  const errorRate = gnlMetrics.requests > 0 ? (gnlMetrics.errors / gnlMetrics.requests) * 100 : 0;

  res.json({
    performance: {
      requests: gnlMetrics.requests,
      errors: gnlMetrics.errors,
      errorRate: `${errorRate.toFixed(2)}%`,
      uptime: uptime,
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      avgContextTime: `${avgContextTime.toFixed(2)}ms`,
      avgAiTime: `${avgAiTime.toFixed(2)}ms`,
      cacheHits: gnlMetrics.cacheHits,
      flyIOCalls: gnlMetrics.flyIOCalls
    },
    gnl: {
      projectQueries: gnlMetrics.projectQueries,
      portfolioQueries: gnlMetrics.portfolioQueries,
      quickWinsQueries: gnlMetrics.quickWinsQueries,
      focusAreasQueries: gnlMetrics.focusAreasQueries,
      activeSessions: gnlMetrics.sessions.size
    },
    system: {
      activeRequests,
      queuedRequests: requestQueue.length,
      maxConcurrentRequests: GNL_CONFIG.maxConcurrentRequests,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Get GNL-specific system prompt
 */
function getGNLSystemPrompt(contextType, context) {
  const basePrompt = `You are the GitHub Notion Logger (GNL) AI Assistant, specialized in helping developers manage their project portfolios, track progress, and identify optimization opportunities. You have deep knowledge of software development workflows, project management, and productivity optimization.`;

  switch (contextType) {
    case 'project':
      return `${basePrompt} You are analyzing a specific project in the user's portfolio. Provide detailed, actionable insights about project health, progress, and recommendations for improvement.`;
    
    case 'portfolio':
      return `${basePrompt} You are analyzing the user's entire project portfolio. Provide comprehensive insights about project distribution, overall health, productivity patterns, and strategic recommendations.`;
    
    case 'quickWins':
      return `${basePrompt} You are identifying quick wins - high-impact, low-effort tasks that can provide immediate value. Focus on actionable, achievable recommendations that can be completed quickly.`;
    
    case 'focusAreas':
      return `${basePrompt} You are identifying focus areas - projects or issues that need immediate attention. Prioritize based on impact, urgency, and potential risks.`;
    
    case 'planning':
      return `${basePrompt} You are helping with project planning and strategic decision-making. Focus on goals, blockers, dependencies, resource allocation, and long-term planning.`;
    
    case 'productivity':
      return `${basePrompt} You are analyzing productivity patterns and development workflows. Focus on efficiency improvements, velocity optimization, and workflow enhancements.`;
    
    case 'quality':
      return `${basePrompt} You are analyzing code quality and technical health. Focus on best practices, technical debt, code quality improvements, and maintainability.`;
    
    default:
      return basePrompt;
  }
}

/**
 * Generate GNL-specific analysis
 */
function generateGNLAnalysis(type, context, options) {
  const analysis = {
    type,
    timestamp: new Date().toISOString(),
    insights: [],
    recommendations: [],
    metrics: {}
  };
  
  switch (type) {
    case 'quickWins':
      if (context.analysis?.quickWins) {
        analysis.insights = context.analysis.quickWins.map(win => ({
          title: win.title,
          description: win.description,
          impact: win.impact,
          effort: win.effort,
          priority: win.priority
        }));
      }
      break;
    
    case 'focusAreas':
      if (context.analysis?.focusAreas) {
        analysis.insights = context.analysis.focusAreas.map(area => ({
          title: area.title,
          description: area.description,
          priority: area.priority,
          riskLevel: area.riskLevel
        }));
      }
      break;
    
    case 'portfolio':
      analysis.metrics = {
        totalProjects: context.analysis?.totalProjects || 0,
        activeProjects: context.analysis?.activeProjects || 0,
        completedProjects: context.analysis?.completedProjects || 0
      };
      break;
    
    default:
      analysis.insights = [{
        title: 'Analysis Complete',
        description: 'Analysis completed successfully',
        priority: 'medium'
      }];
  }
  
  return analysis;
}

// Session cleanup for GNL
setInterval(() => {
  try {
    const now = Date.now();
    let cleanedSessions = 0;
    
    for (const [sessionId, metrics] of gnlMetrics.sessions.entries()) {
      if (now - metrics.lastActivity > GNL_CONFIG.sessionTimeout) {
        gnlMetrics.sessions.delete(sessionId);
        cleanedSessions++;
      }
    }
    
    if (cleanedSessions > 0) {
      console.log(`🧹 [GNL] Cleaned up ${cleanedSessions} expired sessions`);
    }
  } catch (error) {
    console.error('❌ [GNL] Error during session cleanup:', error);
  }
}, GNL_CONFIG.sessionCleanupInterval);

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 [GNL] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 [GNL] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start GNL Assistant server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GNL Assistant Server started on port ${PORT}`);
  console.log(`📡 Connected to Fly.io: ${FLY_IO_BASE_URL}`);
  console.log(`🔑 Llama-hub URL: ${process.env.LLAMA_HUB_URL || 'http://localhost:9000'}`);
  console.log(`🤖 Default model: ${process.env.LLAMA_DEFAULT_MODEL || 'llama3-7b'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Max concurrent requests: ${GNL_CONFIG.maxConcurrentRequests}`);
  console.log(`🧹 Session cleanup interval: ${GNL_CONFIG.sessionCleanupInterval / 1000}s`);
  console.log(`📈 Performance monitoring: /metrics`);
  console.log(`🔍 Health check: /health`);
  console.log(`🎯 GNL-specific optimizations enabled`);
});

module.exports = app;
