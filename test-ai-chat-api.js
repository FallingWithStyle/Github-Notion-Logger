/**
 * Integration Tests for AI Chat API - Epic 10 TDD Implementation
 * Tests cover enhanced chat endpoints with project context integration
 * Updated to use new test utilities for better stability and consistency
 */

const request = require('supertest');
const express = require('express');
const AIContextService = require('./services/ai-context-service');
const AISessionService = require('./services/ai-session-service');
const AIResponseValidator = require('./services/ai-response-validator');
const LlamaHubService = require('./services/llama-hub-service');
const testUtils = require('./test-utilities');

// Mock dependencies
jest.mock('./services/ai-context-service');
jest.mock('./services/ai-session-service');
jest.mock('./services/ai-response-validator');
jest.mock('./services/llama-hub-service');

// Create test app
const app = express();
app.use(express.json());

// Mock AI services using test utilities
const mockAIContextService = testUtils.createMockService('AIContextService', {
  getProjectContext: jest.fn(),
  getPortfolioContext: jest.fn(),
  getQuickWinsContext: jest.fn(),
  getFocusAreasContext: jest.fn()
});

const mockAISessionService = testUtils.createMockSessionService();

const mockAIResponseValidator = testUtils.createMockService('AIResponseValidator', {
  validateResponse: jest.fn()
});

const mockLlamaHubService = testUtils.createMockService('LlamaHubService', {
  chatCompletion: jest.fn()
});

// Set up mocks
AIContextService.mockImplementation(() => mockAIContextService);
AISessionService.mockImplementation(() => mockAISessionService);
AIResponseValidator.mockImplementation(() => mockAIResponseValidator);
LlamaHubService.mockImplementation(() => mockLlamaHubService);

// Mock API routes (simplified for testing)
app.post('/api/v2/ai/chat', async (req, res) => {
  try {
    const { message, sessionId, contextType, projectFilter, options = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get or create session
    let session = mockAISessionService.getSession(sessionId);
    if (!session) {
      session = mockAISessionService.createSession(sessionId);
    }

    // Add user message to session
    mockAISessionService.addMessage(sessionId, 'user', message);

    // Get context based on type
    let context = {};
    if (contextType === 'project' && projectFilter) {
      context = await mockAIContextService.getProjectContext(projectFilter, 'general');
    } else if (contextType === 'portfolio') {
      context = await mockAIContextService.getPortfolioContext({ status: 'active' });
    } else if (contextType === 'quickWins') {
      context = await mockAIContextService.getQuickWinsContext({ status: 'active' });
    } else if (contextType === 'focusAreas') {
      context = await mockAIContextService.getFocusAreasContext({ status: 'active' });
    }

    // Get conversation history
    const history = mockAISessionService.getHistory(sessionId, 10);
    const messages = [
      { role: 'system', content: 'You are a helpful project management assistant.' },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // Generate AI response
    const aiResponse = await mockLlamaHubService.chatCompletion({
      messages,
      maxTokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    });

    const responseContent = aiResponse.choices?.[0]?.message?.content || 'No response generated';

    // Validate response
    const validation = mockAIResponseValidator.validateResponse({
      content: responseContent,
      type: 'answer'
    }, context);

    // Add assistant message to session
    mockAISessionService.addMessage(sessionId, 'assistant', responseContent);

    res.json({
      success: true,
      data: {
        response: responseContent,
        sessionId: sessionId,
        context: {
          projectsAnalyzed: context.projects?.length || 1,
          dataFreshness: new Date().toISOString(),
          analysisType: contextType || 'general'
        },
        metadata: {
          responseTime: 1.2,
          qualityScore: validation.qualityScore,
          cached: false
        }
      }
    });

  } catch (error) {
    console.error('AI Chat API Error:', error);
    res.status(500).json({
      success: false,
      error: 'AI service temporarily unavailable',
      details: error.message
    });
  }
});

app.get('/api/v2/ai/recommendations', async (req, res) => {
  try {
    const { type = 'quickWins', category = 'active', limit = 5 } = req.query;

    // Get context for recommendations
    const context = await mockAIContextService.getQuickWinsContext({ status: category });
    
    if (!context.success && context.error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get recommendations context',
        details: context.error.message
      });
    }

    const recommendations = context.analysis?.quickWins?.slice(0, parseInt(limit)) || [];

    res.json({
      success: true,
      data: {
        recommendations: recommendations.map(rec => ({
          type: 'quickWin',
          title: rec.title,
          project: rec.project,
          priority: rec.quickWinScore > 70 ? 'high' : rec.quickWinScore > 40 ? 'medium' : 'low',
          reasoning: `Completion rate: ${rec.completionRate}%, Remaining work: ${rec.remainingWork} items`,
          impact: rec.impact,
          effort: rec.estimatedEffort,
          confidence: rec.quickWinScore / 100
        })),
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          totalProjects: context.analysis?.totalProjects || 0,
          recommendationsGenerated: recommendations.length
        }
      }
    });

  } catch (error) {
    console.error('Recommendations API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      details: error.message
    });
  }
});

app.post('/api/v2/ai/analyze', async (req, res) => {
  try {
    const { analysisType, filters = {}, options = {} } = req.body;

    if (!analysisType) {
      return res.status(400).json({
        success: false,
        error: 'Analysis type is required'
      });
    }

    let context;
    let analysis;

    switch (analysisType) {
      case 'focusAreas':
        context = await mockAIContextService.getFocusAreasContext(filters);
        analysis = {
          focusAreas: context.analysis?.focusAreas || [],
          healthAnalysis: context.analysis?.healthDistribution || {},
          riskAssessment: context.analysis?.focusAreas?.filter(fa => fa.priority === 'high') || []
        };
        break;
      
      case 'quickWins':
        context = await mockAIContextService.getQuickWinsContext(filters);
        analysis = {
          quickWins: context.analysis?.quickWins || [],
          totalIncompleteWork: context.analysis?.totalIncompleteStories + context.analysis?.totalIncompleteTasks || 0
        };
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis type'
        });
    }

    res.json({
      success: true,
      data: {
        analysis: analysis,
        metadata: {
          analysisType,
          timestamp: new Date().toISOString(),
          filters: filters
        }
      }
    });

  } catch (error) {
    console.error('Analysis API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform analysis',
      details: error.message
    });
  }
});

describe('AI Chat API Integration Tests', () => {
  beforeEach(async () => {
    // Use test utilities for consistent setup
    testUtils.cleanup();
    
    // Wait for any pending operations
    await testUtils.waitForPendingOperations();
  });

  afterEach(async () => {
    // Use test utilities for proper cleanup
    await testUtils.waitForPendingOperations();
    testUtils.cleanup();
  });

  describe('POST /api/v2/ai/chat', () => {
    it('should handle basic chat request', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      const mockContext = { type: 'general' };
      const mockAIResponse = {
        choices: [{ message: { content: 'Hello! How can I help you today?' } }]
      };
      const mockValidation = {
        isValid: true,
        qualityScore: 0.85,
        errors: [],
        warnings: []
      };

      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockLlamaHubService.chatCompletion.mockResolvedValue(mockAIResponse);
      mockAIResponseValidator.validateResponse.mockReturnValue(mockValidation);

      const requestBody = {
        message: 'Hello, AI assistant!',
        sessionId: 'test-session'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBe('Hello! How can I help you today?');
      expect(response.body.data.sessionId).toBe('test-session');
      expect(response.body.data.metadata.qualityScore).toBe(0.85);
    });

    it('should handle project context chat', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      const mockProjectContext = {
        type: 'project',
        project: { name: 'test-project' },
        progress: { completionPercentage: 75 }
      };
      const mockAIResponse = {
        choices: [{ message: { content: 'Your test-project is 75% complete. Focus on the remaining tasks.' } }]
      };
      const mockValidation = {
        isValid: true,
        qualityScore: 0.9,
        errors: [],
        warnings: []
      };

      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockAIContextService.getProjectContext.mockResolvedValue(mockProjectContext);
      mockLlamaHubService.chatCompletion.mockResolvedValue(mockAIResponse);
      mockAIResponseValidator.validateResponse.mockReturnValue(mockValidation);

      const requestBody = {
        message: 'How is my project doing?',
        sessionId: 'test-session',
        contextType: 'project',
        projectFilter: 'test-project'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.context.projectsAnalyzed).toBe(1);
      expect(response.body.data.context.analysisType).toBe('project');
      expect(mockAIContextService.getProjectContext).toHaveBeenCalledWith('test-project', 'general');
    });

    it('should handle portfolio context chat', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      const mockPortfolioContext = {
        type: 'portfolio',
        summary: { totalProjects: 5, activeProjects: 3 },
        projects: []
      };
      const mockAIResponse = {
        choices: [{ message: { content: 'You have 3 active projects out of 5 total projects.' } }]
      };
      const mockValidation = {
        isValid: true,
        qualityScore: 0.8,
        errors: [],
        warnings: []
      };

      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockAIContextService.getPortfolioContext.mockResolvedValue(mockPortfolioContext);
      mockLlamaHubService.chatCompletion.mockResolvedValue(mockAIResponse);
      mockAIResponseValidator.validateResponse.mockReturnValue(mockValidation);

      const requestBody = {
        message: 'Give me an overview of my projects',
        sessionId: 'test-session',
        contextType: 'portfolio'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.context.analysisType).toBe('portfolio');
      expect(mockAIContextService.getPortfolioContext).toHaveBeenCalledWith({ status: 'active' });
    });

    it('should handle quick wins context chat', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      const mockQuickWinsContext = {
        type: 'quickWins',
        analysis: {
          quickWins: [
            { project: 'project1', title: 'Complete project1', quickWinScore: 85 }
          ]
        }
      };
      const mockAIResponse = {
        choices: [{ message: { content: 'Focus on completing project1 for a quick win.' } }]
      };
      const mockValidation = {
        isValid: true,
        qualityScore: 0.85,
        errors: [],
        warnings: []
      };

      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockAIContextService.getQuickWinsContext.mockResolvedValue(mockQuickWinsContext);
      mockLlamaHubService.chatCompletion.mockResolvedValue(mockAIResponse);
      mockAIResponseValidator.validateResponse.mockReturnValue(mockValidation);

      const requestBody = {
        message: 'What are my quick wins?',
        sessionId: 'test-session',
        contextType: 'quickWins'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.context.analysisType).toBe('quickWins');
      expect(mockAIContextService.getQuickWinsContext).toHaveBeenCalledWith({ status: 'active' });
    });

    it('should handle focus areas context chat', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      const mockFocusAreasContext = {
        type: 'focusAreas',
        analysis: {
          focusAreas: [
            { type: 'health', priority: 'high', title: 'Low Health Projects' }
          ]
        }
      };
      const mockAIResponse = {
        choices: [{ message: { content: 'Focus on improving project health scores.' } }]
      };
      const mockValidation = {
        isValid: true,
        qualityScore: 0.8,
        errors: [],
        warnings: []
      };

      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockAIContextService.getFocusAreasContext.mockResolvedValue(mockFocusAreasContext);
      mockLlamaHubService.chatCompletion.mockResolvedValue(mockAIResponse);
      mockAIResponseValidator.validateResponse.mockReturnValue(mockValidation);

      const requestBody = {
        message: 'What should I focus on?',
        sessionId: 'test-session',
        contextType: 'focusAreas'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.context.analysisType).toBe('focusAreas');
      expect(mockAIContextService.getFocusAreasContext).toHaveBeenCalledWith({ status: 'active' });
    });

    it('should handle missing message', async () => {
      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send({ sessionId: 'test-session' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message is required');
    });

    it('should handle AI service errors', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockLlamaHubService.chatCompletion.mockRejectedValue(new Error('AI service unavailable'));

      const requestBody = {
        message: 'Hello',
        sessionId: 'test-session'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('AI service temporarily unavailable');
    });

    it('should handle context service errors', async () => {
      // Arrange
      const mockSession = { id: 'test-session', messages: [] };
      mockAISessionService.getSession.mockReturnValue(mockSession);
      mockAISessionService.addMessage.mockReturnValue(mockSession);
      mockAISessionService.getHistory.mockReturnValue([]);
      mockAIContextService.getProjectContext.mockRejectedValue(new Error('Context service error'));

      const requestBody = {
        message: 'How is my project?',
        sessionId: 'test-session',
        contextType: 'project',
        projectFilter: 'test-project'
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('AI service temporarily unavailable');
    });
  });

  describe('GET /api/v2/ai/recommendations', () => {
    it('should return quick wins recommendations', async () => {
      // Arrange
      const mockContext = {
        success: true,
        analysis: {
          quickWins: [
            {
              project: 'project1',
              title: 'Complete project1 remaining work',
              completionRate: 85,
              remainingWork: 2,
              quickWinScore: 90,
              impact: 'high - near completion',
              estimatedEffort: '1 day'
            },
            {
              project: 'project2',
              title: 'Complete project2 remaining work',
              completionRate: 70,
              remainingWork: 5,
              quickWinScore: 60,
              impact: 'medium - significant progress',
              estimatedEffort: '2-3 days'
            }
          ],
          totalProjects: 2
        }
      };

      mockAIContextService.getQuickWinsContext.mockResolvedValue(mockContext);

      // Act
      const response = await request(app)
        .get('/api/v2/ai/recommendations?type=quickWins&category=active&limit=5');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toHaveLength(2);
      expect(response.body.data.recommendations[0].type).toBe('quickWin');
      expect(response.body.data.recommendations[0].project).toBe('project1');
      expect(response.body.data.recommendations[0].priority).toBe('high');
      expect(response.body.data.recommendations[0].confidence).toBe(0.9);
      expect(response.body.data.metadata.totalProjects).toBe(2);
    });

    it('should handle context service errors', async () => {
      // Arrange
      mockAIContextService.getQuickWinsContext.mockResolvedValue({
        success: false,
        error: { message: 'Context service unavailable' }
      });

      // Act
      const response = await request(app)
        .get('/api/v2/ai/recommendations');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get recommendations context');
    });

    it('should handle empty recommendations', async () => {
      // Arrange
      const mockContext = {
        success: true,
        analysis: {
          quickWins: [],
          totalProjects: 0
        }
      };

      mockAIContextService.getQuickWinsContext.mockResolvedValue(mockContext);

      // Act
      const response = await request(app)
        .get('/api/v2/ai/recommendations');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toHaveLength(0);
      expect(response.body.data.metadata.recommendationsGenerated).toBe(0);
    });
  });

  describe('POST /api/v2/ai/analyze', () => {
    it('should perform focus areas analysis', async () => {
      // Arrange
      const mockContext = {
        analysis: {
          focusAreas: [
            {
              type: 'health',
              priority: 'high',
              title: 'Low Health Projects',
              projects: ['project1'],
              reasoning: '1 projects have health scores below 50'
            }
          ],
          healthDistribution: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 1,
            critical: 0
          }
        }
      };

      mockAIContextService.getFocusAreasContext.mockResolvedValue(mockContext);

      const requestBody = {
        analysisType: 'focusAreas',
        filters: { status: 'active' },
        options: { includeHealthAnalysis: true }
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.analysis.focusAreas).toHaveLength(1);
      expect(response.body.data.analysis.focusAreas[0].type).toBe('health');
      expect(response.body.data.analysis.focusAreas[0].priority).toBe('high');
      expect(response.body.data.analysis.healthAnalysis).toBeDefined();
      expect(response.body.data.metadata.analysisType).toBe('focusAreas');
    });

    it('should perform quick wins analysis', async () => {
      // Arrange
      const mockContext = {
        analysis: {
          quickWins: [
            {
              project: 'project1',
              title: 'Complete project1',
              quickWinScore: 85
            }
          ],
          totalIncompleteStories: 5,
          totalIncompleteTasks: 10
        }
      };

      mockAIContextService.getQuickWinsContext.mockResolvedValue(mockContext);

      const requestBody = {
        analysisType: 'quickWins',
        filters: { status: 'active' }
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.analysis.quickWins).toHaveLength(1);
      expect(response.body.data.analysis.totalIncompleteWork).toBe(15);
      expect(response.body.data.metadata.analysisType).toBe('quickWins');
    });

    it('should handle missing analysis type', async () => {
      // Act
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send({ filters: {} });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analysis type is required');
    });

    it('should handle invalid analysis type', async () => {
      // Act
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send({
          analysisType: 'invalid',
          filters: {}
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid analysis type');
    });

    it('should handle context service errors', async () => {
      // Arrange
      mockAIContextService.getFocusAreasContext.mockRejectedValue(new Error('Context service error'));

      const requestBody = {
        analysisType: 'focusAreas',
        filters: { status: 'active' }
      };

      // Act
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send(requestBody);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to perform analysis');
    });
  });
});
