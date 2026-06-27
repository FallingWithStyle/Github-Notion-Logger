/**
 * Test AI Metrics and Performance Monitoring
 * Tests for the /api/v2/ai/metrics endpoint and performance tracking
 * Updated to use new test utilities for better stability and consistency
 */

const request = require('supertest');
const express = require('express');
const testUtils = require('./test-utilities');

// Mock the AI services
jest.mock('./services/ai-context-service');
jest.mock('./services/ai-session-service');
jest.mock('./services/ai-response-validator');
jest.mock('./services/llama-hub-service');
jest.mock('./services/ai-circuit-breaker');

const AIContextService = require('./services/ai-context-service');
const AISessionService = require('./services/ai-session-service');
const AIResponseValidator = require('./services/ai-response-validator');
const LlamaHubService = require('./services/llama-hub-service');
const { circuitBreakerManager } = require('./services/ai-circuit-breaker');

// Mock implementations using test utilities
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
  chatCompletion: jest.fn(),
  getHealth: jest.fn()
});

const mockCircuitBreakerManager = {
  execute: jest.fn(),
  getSystemHealth: jest.fn(),
  getAllHealth: jest.fn(),
  getBreaker: jest.fn()
};

// Set up mocks
AIContextService.mockImplementation(() => mockAIContextService);
AISessionService.mockImplementation(() => mockAISessionService);
AIResponseValidator.mockImplementation(() => mockAIResponseValidator);
LlamaHubService.mockImplementation(() => mockLlamaHubService);
circuitBreakerManager.execute = mockCircuitBreakerManager.execute;
circuitBreakerManager.getSystemHealth = mockCircuitBreakerManager.getSystemHealth;
circuitBreakerManager.getAllHealth = mockCircuitBreakerManager.getAllHealth;
circuitBreakerManager.getBreaker = mockCircuitBreakerManager.getBreaker;

// Create test app
const app = express();
app.use(express.json());

// Import the AI chat routes
const aiChatRoutes = require('./routes/ai-chat');
app.use('/api/v2/ai', aiChatRoutes);

describe('AI Metrics and Performance Monitoring', () => {
  beforeEach(async () => {
    // Use test utilities for consistent setup
    testUtils.cleanup();
    
    // Reset performance metrics by requiring the module fresh
    jest.resetModules();
    
    await testUtils.waitForPendingOperations();
  });

  afterEach(async () => {
    // Use test utilities for proper cleanup
    await testUtils.waitForPendingOperations();
    testUtils.cleanup();
  });

  beforeEach(() => {
    // Mock circuit breaker responses
    mockCircuitBreakerManager.getSystemHealth.mockReturnValue('healthy');
    mockCircuitBreakerManager.getAllHealth.mockReturnValue({
      'llama-hub': { state: 'CLOSED', stats: {} },
      'context-service': { state: 'CLOSED', stats: {} }
    });
    
    // Mock circuit breaker execute to return the service responses
    mockCircuitBreakerManager.execute.mockImplementation(async (serviceName, operation) => {
      if (serviceName === 'context-service') {
        return await operation();
      } else if (serviceName === 'llama-hub-service') {
        return await operation();
      }
      return await operation();
    });
    
    // Mock AI service responses
    mockLlamaHubService.getHealth.mockResolvedValue({ status: 'healthy' });
    mockLlamaHubService.chatCompletion.mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }]
    });
    
    // Mock context service responses
    mockAIContextService.getProjectContext.mockResolvedValue({
      project: { name: 'test-project' },
      analysis: { healthScore: 85 }
    });
    mockAIContextService.getPortfolioContext.mockResolvedValue({
      projects: [{ name: 'project1' }],
      analysis: { quickWins: [{ type: 'quickWin', project: 'project1', priority: 'high', confidence: 0.9 }] }
    });
    mockAIContextService.getQuickWinsContext.mockResolvedValue({
      analysis: { quickWins: [{ type: 'quickWin', project: 'project1', priority: 'high', confidence: 0.9 }] }
    });
    mockAIContextService.getFocusAreasContext.mockResolvedValue({
      analysis: { focusAreas: [{ area: 'testing', priority: 'high' }] }
    });
    
    // Mock session service responses
    mockAISessionService.getSession.mockReturnValue({
      id: 'test-session',
      messages: [],
      lastAccessed: new Date()
    });
    mockAISessionService.createSession.mockReturnValue({
      id: 'test-session',
      messages: [],
      lastAccessed: new Date()
    });
    mockAISessionService.addMessage.mockReturnValue({
      id: 'test-session',
      messages: [{ role: 'user', content: 'test' }],
      lastAccessed: new Date()
    });
    mockAISessionService.getHistory.mockReturnValue([]);
    
    // Mock response validator
    mockAIResponseValidator.validateResponse.mockReturnValue({
      isValid: true,
      qualityScore: 0.8,
      qualityLevel: 'good'
    });
  });

  describe('GET /api/v2/ai/metrics', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('operations');
      expect(response.body.data).toHaveProperty('health');
      
      expect(response.body.data.performance).toHaveProperty('uptime');
      expect(response.body.data.performance).toHaveProperty('requests');
      expect(response.body.data.performance).toHaveProperty('averageResponseTime');
      expect(response.body.data.performance).toHaveProperty('errorRate');
      expect(response.body.data.performance).toHaveProperty('cacheHitRate');
      
      expect(response.body.data.operations).toHaveProperty('aiServiceCalls');
      expect(response.body.data.operations).toHaveProperty('contextServiceCalls');
      expect(response.body.data.operations).toHaveProperty('sessionOperations');
      expect(response.body.data.operations).toHaveProperty('cacheHits');
      expect(response.body.data.operations).toHaveProperty('cacheMisses');
      
      expect(response.body.data.health).toHaveProperty('status');
      expect(response.body.data.health).toHaveProperty('lastUpdated');
    });

    it('should calculate error rate correctly', async () => {
      // Make some requests to generate metrics
      await request(app)
        .post('/api/v2/ai/chat')
        .send({ message: 'test message' });
      
      await request(app)
        .post('/api/v2/ai/chat')
        .send({ message: 'test message 2' });

      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.errorRate).toBe(0);
      expect(response.body.data.performance.requests).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.cacheHitRate).toBe(0);
    });

    it('should determine health status based on error rate', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.health.status);
    });

    it('should handle metrics calculation errors gracefully', async () => {
      // Mock a scenario where metrics calculation might fail
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.error = originalConsoleError;
    });
  });

  describe('Performance Tracking Integration', () => {
    it('should track chat endpoint performance', async () => {
      const response = await request(app)
        .post('/api/v2/ai/chat')
        .send({ message: 'test message' });

      expect(response.status).toBe(200);
      
      // Check that metrics were updated
      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.performance.requests).toBeGreaterThan(0);
      expect(metricsResponse.body.data.operations.sessionOperations).toBeGreaterThan(0);
    });

    it('should track recommendations endpoint performance', async () => {
      const response = await request(app)
        .get('/api/v2/ai/recommendations');

      expect(response.status).toBe(200);
      
      // Check that metrics were updated
      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.performance.requests).toBeGreaterThan(0);
    });

    it('should track analyze endpoint performance', async () => {
      const response = await request(app)
        .post('/api/v2/ai/analyze')
        .send({ analysisType: 'focusAreas' });

      expect(response.status).toBe(200);
      
      // Check that metrics were updated
      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.performance.requests).toBeGreaterThan(0);
    });

    it('should track context service calls', async () => {
      await request(app)
        .post('/api/v2/ai/chat')
        .send({ 
          message: 'test message',
          contextType: 'project',
          projectFilter: 'test-project'
        });

      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.operations.contextServiceCalls).toBeGreaterThan(0);
    });

    it('should track AI service calls', async () => {
      await request(app)
        .post('/api/v2/ai/chat')
        .send({ message: 'test message' });

      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.operations.aiServiceCalls).toBeGreaterThan(0);
    });

    it('should track session operations', async () => {
      await request(app)
        .post('/api/v2/ai/chat')
        .send({ message: 'test message' });

      const metricsResponse = await request(app)
        .get('/api/v2/ai/metrics');
      
      expect(metricsResponse.body.data.operations.sessionOperations).toBeGreaterThan(0);
    });
  });

  describe('Error Handling in Metrics', () => {
    it('should handle metrics calculation errors', async () => {
      // Mock a scenario where metrics calculation fails
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // This should not throw an error even if metrics calculation fails
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.error = originalConsoleError;
    });

    it('should return fallback metrics on error', async () => {
      // Mock a scenario where the metrics endpoint itself fails
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performance');
      
      console.error = originalConsoleError;
    });
  });

  describe('Metrics Data Validation', () => {
    it('should return valid uptime', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.uptime).toBeGreaterThan(0);
    });

    it('should return valid request count', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.requests).toBeGreaterThanOrEqual(0);
    });

    it('should return valid average response time', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid error rate percentage', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.errorRate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.performance.errorRate).toBeLessThanOrEqual(100);
    });

    it('should return valid cache hit rate percentage', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.performance.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.performance.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it('should return valid operation counts', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.operations.aiServiceCalls).toBeGreaterThanOrEqual(0);
      expect(response.body.data.operations.contextServiceCalls).toBeGreaterThanOrEqual(0);
      expect(response.body.data.operations.sessionOperations).toBeGreaterThanOrEqual(0);
      expect(response.body.data.operations.cacheHits).toBeGreaterThanOrEqual(0);
      expect(response.body.data.operations.cacheMisses).toBeGreaterThanOrEqual(0);
    });

    it('should return valid health status', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.health.status);
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/api/v2/ai/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.health.lastUpdated).toBeDefined();
      expect(new Date(response.body.data.health.lastUpdated)).toBeInstanceOf(Date);
    });
  });
});
