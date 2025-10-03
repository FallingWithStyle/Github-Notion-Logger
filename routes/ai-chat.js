/**
 * AI Chat API Routes - Epic 10 Implementation
 * Enhanced chat endpoints with project context integration
 */

const express = require('express');
const AIContextService = require('../services/ai-context-service');
const AISessionService = require('../services/ai-session-service');
const AIResponseValidator = require('../services/ai-response-validator');
const LlamaHubService = require('../services/llama-hub-service');
const { circuitBreakerManager } = require('../services/ai-circuit-breaker');

// Async handler utility
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Performance monitoring
const performanceMetrics = {
  requests: 0,
  totalResponseTime: 0,
  averageResponseTime: 0,
  errors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  aiServiceCalls: 0,
  contextServiceCalls: 0,
  sessionOperations: 0,
  startTime: Date.now()
};

// Helper function to update performance metrics
function updateMetrics(operation, duration, success = true) {
  performanceMetrics.requests++;
  performanceMetrics.totalResponseTime += duration;
  performanceMetrics.averageResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.requests;
  
  if (!success) {
    performanceMetrics.errors++;
  }
  
  switch (operation) {
    case 'ai-service':
      performanceMetrics.aiServiceCalls++;
      break;
    case 'context-service':
      performanceMetrics.contextServiceCalls++;
      break;
    case 'session':
      performanceMetrics.sessionOperations++;
      break;
    case 'cache-hit':
      performanceMetrics.cacheHits++;
      break;
    case 'cache-miss':
      performanceMetrics.cacheMisses++;
      break;
  }
}

const router = express.Router();

// Initialize AI services
const aiContextService = new AIContextService();
const aiSessionService = new AISessionService();
const aiResponseValidator = new AIResponseValidator();
const llamaHubService = new LlamaHubService();

/**
 * Enhanced Chat API with Project Context
 * POST /api/v2/ai/chat
 */
router.post('/chat', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let success = true;
  
  try {
    const { 
      message, 
      sessionId, 
      contextType = 'general', 
      projectFilter, 
      options = {} 
    } = req.body;

    // Validate required fields
    if (!message) {
      success = false;
      updateMetrics('validation', Date.now() - startTime, false);
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log(`🤖 AI Chat request: ${message.substring(0, 50)}...`);

    // Get or create session
    let session = aiSessionService.getSession(sessionId);
    if (!session) {
      const sessionStart = Date.now();
      session = aiSessionService.createSession(sessionId);
      updateMetrics('session', Date.now() - sessionStart, true);
      console.log(`✨ Created new AI session: ${sessionId}`);
    }

    // Add user message to session
    const messageStart = Date.now();
    aiSessionService.addMessage(sessionId, 'user', message, {
      contextType,
      projectFilter,
      timestamp: new Date().toISOString()
    });
    updateMetrics('session', Date.now() - messageStart, true);

    // Get context based on type with circuit breaker protection
    let context = {};
    let contextStartTime = Date.now();
    
    try {
      switch (contextType) {
        case 'project':
          if (projectFilter) {
            const contextStart = Date.now();
            context = await circuitBreakerManager.execute('context-service', 
              () => aiContextService.getProjectContext(projectFilter, 'general'),
              { operation: 'getProjectContext', project: projectFilter }
            );
            updateMetrics('context-service', Date.now() - contextStart, true);
            console.log(`📊 Retrieved project context for: ${projectFilter}`);
          }
          break;
        
        case 'portfolio':
          const portfolioStart = Date.now();
          context = await circuitBreakerManager.execute('context-service',
            () => aiContextService.getPortfolioContext({ status: 'active' }),
            { operation: 'getPortfolioContext' }
          );
          updateMetrics('context-service', Date.now() - portfolioStart, true);
          console.log(`📊 Retrieved portfolio context`);
          break;
        
        case 'quickWins':
          const quickWinsStart = Date.now();
          context = await circuitBreakerManager.execute('context-service',
            () => aiContextService.getQuickWinsContext({ status: 'active' }),
            { operation: 'getQuickWinsContext' }
          );
          updateMetrics('context-service', Date.now() - quickWinsStart, true);
          console.log(`📊 Retrieved quick wins context`);
          break;
        
        case 'focusAreas':
          const focusAreasStart = Date.now();
          context = await circuitBreakerManager.execute('context-service',
            () => aiContextService.getFocusAreasContext({ status: 'active' }),
            { operation: 'getFocusAreasContext' }
          );
          updateMetrics('context-service', Date.now() - focusAreasStart, true);
          console.log(`📊 Retrieved focus areas context`);
          break;
        
        case 'planning':
          if (projectFilter) {
            const planningStart = Date.now();
            context = await circuitBreakerManager.execute('context-service',
              () => aiContextService.getProjectContext(projectFilter, 'planning'),
              { operation: 'getProjectContext', project: projectFilter, type: 'planning' }
            );
            updateMetrics('context-service', Date.now() - planningStart, true);
            console.log(`📊 Retrieved planning context for: ${projectFilter}`);
          }
          break;
        
        case 'productivity':
          if (projectFilter) {
            const productivityStart = Date.now();
            context = await circuitBreakerManager.execute('context-service',
              () => aiContextService.getProjectContext(projectFilter, 'productivity'),
              { operation: 'getProjectContext', project: projectFilter, type: 'productivity' }
            );
            updateMetrics('context-service', Date.now() - productivityStart, true);
            console.log(`📊 Retrieved productivity context for: ${projectFilter}`);
          }
          break;
        
        case 'quality':
          if (projectFilter) {
            const qualityStart = Date.now();
            context = await circuitBreakerManager.execute('context-service',
              () => aiContextService.getProjectContext(projectFilter, 'quality'),
              { operation: 'getProjectContext', project: projectFilter, type: 'quality' }
            );
            updateMetrics('context-service', Date.now() - qualityStart, true);
            console.log(`📊 Retrieved quality context for: ${projectFilter}`);
          }
          break;
        
        default:
          console.log(`📊 Using general context (no specific context type)`);
      }
    } catch (contextError) {
      console.warn(`⚠️ Context retrieval failed: ${contextError.message}`);
      // Continue without context rather than failing completely
    }

    const contextTime = Date.now() - contextStartTime;

    // Get conversation history
    const historyStart = Date.now();
    const history = aiSessionService.getHistory(sessionId, options.includeHistory !== false ? 10 : 0);
    updateMetrics('session', Date.now() - historyStart, true);
    
    // Build messages for AI
    const messages = [
      {
        role: 'system',
        content: getSystemPrompt(contextType, context)
      },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Generate AI response with circuit breaker protection
    const aiStartTime = Date.now();
    let aiResponse;
    let responseContent = 'No response generated';
    
    try {
      const aiStart = Date.now();
      aiResponse = await circuitBreakerManager.execute('llama-hub-service',
        () => llamaHubService.chatCompletion({
          messages,
          maxTokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          stream: false
        }),
        { operation: 'chatCompletion', contextType, projectFilter }
      );
      
      responseContent = aiResponse.choices?.[0]?.message?.content || 'No response generated';
      updateMetrics('ai-service', Date.now() - aiStart, true);
    } catch (aiError) {
      console.error('❌ AI service failed:', aiError);
      
      // Check if circuit breaker is open
      if (aiError.code === 'CIRCUIT_BREAKER_OPEN') {
        return res.status(503).json(circuitBreakerManager.getBreaker('llama-hub-service').createFallbackResponse('chatCompletion'));
      }
      
      // For other AI errors, provide a fallback response
      responseContent = 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.';
    }

    const aiTime = Date.now() - aiStartTime;

    // Validate response quality
    const validation = aiResponseValidator.validateResponse({
      content: responseContent,
      type: 'answer'
    }, context);

    // Add assistant message to session
    const assistantMessageStart = Date.now();
    aiSessionService.addMessage(sessionId, 'assistant', responseContent, {
      contextType,
      projectFilter,
      qualityScore: validation.qualityScore,
      responseTime: aiTime,
      timestamp: new Date().toISOString()
    });
    updateMetrics('session', Date.now() - assistantMessageStart, true);

    const totalTime = Date.now() - contextStartTime;

    console.log(`✅ AI Chat completed in ${totalTime}ms (context: ${contextTime}ms, AI: ${aiTime}ms)`);

    res.json({
      success: true,
      data: {
        response: responseContent,
        sessionId: sessionId,
        context: {
          projectsAnalyzed: context.projects?.length || (context.project ? 1 : 0),
          dataFreshness: new Date().toISOString(),
          analysisType: contextType,
          contextTime: contextTime,
          aiTime: aiTime
        },
        metadata: {
          responseTime: totalTime,
          qualityScore: validation.qualityScore,
          qualityLevel: validation.qualityLevel,
          responseType: validation.responseType,
          cached: false,
          validation: {
            isValid: validation.isValid,
            warnings: validation.warnings,
            suggestions: validation.suggestions
          }
        }
      }
    });

  } catch (error) {
    success = false;
    console.error('❌ AI Chat API Error:', error);
    res.status(500).json({
      success: false,
      error: 'AI service temporarily unavailable',
      fallback: {
        type: 'error_response',
        data: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.',
        timestamp: new Date().toISOString()
      },
      retryAfter: 30,
      details: {
        errorCode: 'AI_SERVICE_UNAVAILABLE',
        message: error.message
      }
    });
  } finally {
    // Update performance metrics
    const duration = Date.now() - startTime;
    updateMetrics('chat', duration, success);
  }
}));

/**
 * Proactive Recommendations API
 * GET /api/v2/ai/recommendations
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let success = true;
  
  try {
    const { 
      type = 'quickWins', 
      category = 'active', 
      limit = 5,
      projectFilter 
    } = req.query;

    console.log(`🎯 Generating ${type} recommendations for ${category} projects`);

    // Get context for recommendations
    let context;
    const contextStartTime = Date.now();

    try {
      switch (type) {
        case 'quickWins':
          context = await aiContextService.getQuickWinsContext({ 
            status: category,
            ...(projectFilter && { projectName: projectFilter })
          });
          break;
        
        case 'focusAreas':
          context = await aiContextService.getFocusAreasContext({ 
            status: category,
            ...(projectFilter && { projectName: projectFilter })
          });
          break;
        
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid recommendation type',
            validTypes: ['quickWins', 'focusAreas']
          });
      }
    } catch (contextError) {
      console.error('❌ Context retrieval failed:', contextError);
      return res.status(500).json({
        success: false,
        error: 'Failed to get recommendations context',
        details: contextError.message
      });
    }

    const contextTime = Date.now() - contextStartTime;

    if (!context || context.error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get recommendations context',
        details: context.error?.message || 'Unknown context error'
      });
    }

    // Process recommendations based on type
    let recommendations = [];
    
    if (type === 'quickWins' && context.analysis?.quickWins) {
      recommendations = context.analysis.quickWins
        .slice(0, parseInt(limit))
        .map(rec => ({
          type: 'quickWin',
          title: rec.title,
          project: rec.project,
          priority: rec.quickWinScore > 70 ? 'high' : rec.quickWinScore > 40 ? 'medium' : 'low',
          reasoning: `Completion rate: ${rec.completionRate}%, Remaining work: ${rec.remainingWork} items`,
          impact: rec.impact,
          effort: rec.estimatedEffort,
          confidence: Math.round(rec.quickWinScore) / 100,
          quickWinScore: rec.quickWinScore,
          completionRate: rec.completionRate,
          remainingWork: rec.remainingWork,
          velocity: rec.velocity
        }));
    } else if (type === 'focusAreas' && context.analysis?.focusAreas) {
      recommendations = context.analysis.focusAreas
        .slice(0, parseInt(limit))
        .map(fa => ({
          type: 'focusArea',
          title: fa.title,
          priority: fa.priority,
          reasoning: fa.reasoning,
          projects: fa.projects,
          recommendations: fa.recommendations,
          confidence: fa.priority === 'high' ? 0.9 : fa.priority === 'medium' ? 0.7 : 0.5
        }));
    }

    console.log(`✅ Generated ${recommendations.length} ${type} recommendations`);

    res.json({
      success: true,
      data: {
        recommendations: recommendations,
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          totalProjects: context.analysis?.totalProjects || 0,
          recommendationsGenerated: recommendations.length,
          contextTime: contextTime,
          type: type,
          category: category,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    success = false;
    console.error('❌ Recommendations API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      details: error.message
    });
  } finally {
    // Update performance metrics
    const duration = Date.now() - startTime;
    updateMetrics('recommendations', duration, success);
  }
}));

/**
 * Context-Specific Analysis API
 * POST /api/v2/ai/analyze
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let success = true;
  
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
        validTypes: ['focusAreas', 'quickWins', 'health', 'productivity', 'planning']
      });
    }

    console.log(`🔍 Performing ${analysisType} analysis`);

    let context;
    let analysis;
    const contextStartTime = Date.now();

    try {
      switch (analysisType) {
        case 'focusAreas':
          context = await aiContextService.getFocusAreasContext(filters);
          analysis = {
            focusAreas: context.analysis?.focusAreas || [],
            healthAnalysis: context.analysis?.healthDistribution || {},
            riskAssessment: context.analysis?.focusAreas?.filter(fa => fa.priority === 'high') || [],
            totalProjects: context.analysis?.totalProjects || 0
          };
          break;
        
        case 'quickWins':
          context = await aiContextService.getQuickWinsContext(filters);
          analysis = {
            quickWins: context.analysis?.quickWins || [],
            totalIncompleteWork: (context.analysis?.totalIncompleteStories || 0) + (context.analysis?.totalIncompleteTasks || 0),
            totalProjects: context.analysis?.totalProjects || 0,
            averageCompletionRate: context.analysis?.quickWins?.length > 0 
              ? Math.round(context.analysis.quickWins.reduce((sum, qw) => sum + qw.completionRate, 0) / context.analysis.quickWins.length)
              : 0
          };
          break;
        
        case 'health':
          if (filters.projectName) {
            context = await aiContextService.getProjectContext(filters.projectName, 'quality');
            analysis = {
              projectHealth: context.health || {},
              codeQuality: context.quality?.codeQuality || {},
              maintenance: context.quality?.maintenance || {},
              recommendations: generateHealthRecommendations(context)
            };
          } else {
            context = await aiContextService.getPortfolioContext(filters);
            analysis = {
              portfolioHealth: {
                averageHealthScore: context.summary?.averageHealthScore || 0,
                healthDistribution: context.projects?.reduce((dist, project) => {
                  const score = project.healthScore || 0;
                  if (score >= 80) dist.excellent++;
                  else if (score >= 60) dist.good++;
                  else if (score >= 40) dist.fair++;
                  else if (score >= 20) dist.poor++;
                  else dist.critical++;
                  return dist;
                }, { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 }) || {},
                totalProjects: context.summary?.totalProjects || 0
              }
            };
          }
          break;
        
        case 'productivity':
          if (filters.projectName) {
            context = await aiContextService.getProjectContext(filters.projectName, 'productivity');
            analysis = {
              productivity: context.productivity || {},
              efficiency: context.productivity?.efficiency || {},
              recentActivity: context.productivity?.recentActivity || {},
              recommendations: generateProductivityRecommendations(context)
            };
          } else {
            context = await aiContextService.getPortfolioContext(filters);
            analysis = {
              portfolioProductivity: {
                totalProjects: context.summary?.totalProjects || 0,
                averageCompletion: context.summary?.totalCompletion || 0,
                activeProjects: context.summary?.activeProjects || 0
              }
            };
          }
          break;
        
        case 'planning':
          if (filters.projectName) {
            context = await aiContextService.getProjectContext(filters.projectName, 'planning');
            analysis = {
              planning: context.planning || {},
              project: context.project || {},
              recommendations: generatePlanningRecommendations(context)
            };
          } else {
            return res.status(400).json({
              success: false,
              error: 'Planning analysis requires a specific project name'
            });
          }
          break;
        
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid analysis type',
            validTypes: ['focusAreas', 'quickWins', 'health', 'productivity', 'planning']
          });
      }
    } catch (contextError) {
      console.error('❌ Context retrieval failed:', contextError);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve analysis context',
        details: contextError.message
      });
    }

    const contextTime = Date.now() - contextStartTime;

    console.log(`✅ ${analysisType} analysis completed in ${contextTime}ms`);

    res.json({
      success: true,
      data: {
        analysis: analysis,
        metadata: {
          analysisType,
          timestamp: new Date().toISOString(),
          contextTime: contextTime,
          filters: filters,
          options: options
        }
      }
    });

  } catch (error) {
    success = false;
    console.error('❌ Analysis API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform analysis',
      details: error.message
    });
  } finally {
    // Update performance metrics
    const duration = Date.now() - startTime;
    updateMetrics('analyze', duration, success);
  }
}));

/**
 * Get system prompt based on context type
 */
function getSystemPrompt(contextType, context) {
  const basePrompt = `You are a helpful AI project management assistant. You help users understand their projects, identify quick wins, and provide actionable recommendations.`;

  switch (contextType) {
    case 'project':
      return `${basePrompt} You are currently analyzing a specific project. Use the provided project data to give specific, actionable advice.`;
    
    case 'portfolio':
      return `${basePrompt} You are analyzing the user's entire project portfolio. Provide insights about project distribution, health, and overall progress.`;
    
    case 'quickWins':
      return `${basePrompt} You are helping identify quick wins - projects or tasks that can be completed quickly with high impact. Focus on actionable, achievable recommendations.`;
    
    case 'focusAreas':
      return `${basePrompt} You are helping identify focus areas - projects or issues that need immediate attention. Prioritize based on impact and urgency.`;
    
    case 'planning':
      return `${basePrompt} You are helping with project planning. Focus on goals, blockers, dependencies, and strategic planning advice.`;
    
    case 'productivity':
      return `${basePrompt} You are analyzing productivity patterns. Focus on efficiency, velocity, and ways to improve development workflow.`;
    
    case 'quality':
      return `${basePrompt} You are analyzing code quality and project health. Focus on best practices, technical debt, and quality improvements.`;
    
    default:
      return basePrompt;
  }
}

/**
 * Generate health recommendations based on context
 */
function generateHealthRecommendations(context) {
  const recommendations = [];
  
  if (context.health?.healthScore < 50) {
    recommendations.push('Focus on improving project health - address risk factors and increase activity');
  }
  
  if (context.quality?.codeQuality?.commitFrequency === 'rare') {
    recommendations.push('Increase commit frequency to improve code quality tracking');
  }
  
  if (!context.quality?.documentation?.prdPresent) {
    recommendations.push('Create a Product Requirements Document (PRD) for better project planning');
  }
  
  if (!context.quality?.documentation?.taskListPresent) {
    recommendations.push('Create a task list to track project progress');
  }
  
  return recommendations;
}

/**
 * Generate productivity recommendations based on context
 */
function generateProductivityRecommendations(context) {
  const recommendations = [];
  
  if (context.productivity?.velocity < 1.0) {
    recommendations.push('Focus on increasing development velocity - consider breaking down large tasks');
  }
  
  if (context.productivity?.recentActivity?.activityLevel === 'low') {
    recommendations.push('Increase recent activity - commit more frequently to maintain momentum');
  }
  
  if (context.productivity?.efficiency?.estimatedTimeToComplete > 30) {
    recommendations.push('Consider accelerating development - project timeline may be too long');
  }
  
  return recommendations;
}

/**
 * Generate planning recommendations based on context
 */
function generatePlanningRecommendations(context) {
  const recommendations = [];
  
  if (context.planning?.prdStatus === 'missing') {
    recommendations.push('Create a Product Requirements Document to improve project planning');
  }
  
  if (context.planning?.taskListStatus === 'missing') {
    recommendations.push('Create a detailed task list to track progress and dependencies');
  }
  
  if (context.planning?.blockers?.length > 0) {
    recommendations.push(`Address blockers: ${context.planning.blockers.join(', ')}`);
  }
  
  return recommendations;
}

/**
 * AI Services Health Check
 * GET /api/v2/ai/health
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const systemHealth = circuitBreakerManager.getSystemHealth();
    const serviceHealth = circuitBreakerManager.getAllHealth();
    
    // Test basic AI service connectivity
    let aiServiceStatus = 'unknown';
    try {
      await circuitBreakerManager.execute('llama-hub-service',
        () => llamaHubService.getHealth(),
        { operation: 'healthCheck' }
      );
      aiServiceStatus = 'healthy';
    } catch (error) {
      aiServiceStatus = 'unhealthy';
    }

    res.json({
      success: true,
      data: {
        overall: systemHealth,
        services: {
          'llama-hub': {
            ...serviceHealth['llama-hub'],
            connectivity: aiServiceStatus
          },
          'context-service': serviceHealth['context-service']
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
}));

/**
 * Performance Metrics API
 * GET /api/v2/ai/metrics
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  try {
    const uptime = Date.now() - performanceMetrics.startTime;
    const errorRate = performanceMetrics.requests > 0 ? (performanceMetrics.errors / performanceMetrics.requests) * 100 : 0;
    const cacheHitRate = (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) > 0 
      ? (performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        performance: {
          uptime: uptime,
          requests: performanceMetrics.requests,
          averageResponseTime: Math.round(performanceMetrics.averageResponseTime),
          errorRate: Math.round(errorRate * 100) / 100,
          cacheHitRate: Math.round(cacheHitRate * 100) / 100
        },
        operations: {
          aiServiceCalls: performanceMetrics.aiServiceCalls,
          contextServiceCalls: performanceMetrics.contextServiceCalls,
          sessionOperations: performanceMetrics.sessionOperations,
          cacheHits: performanceMetrics.cacheHits,
          cacheMisses: performanceMetrics.cacheMisses
        },
        health: {
          status: errorRate < 10 ? 'healthy' : errorRate < 25 ? 'degraded' : 'unhealthy',
          lastUpdated: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('❌ Metrics API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      details: error.message
    });
  }
}));

module.exports = router;
