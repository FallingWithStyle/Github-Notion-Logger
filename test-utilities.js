/**
 * Reusable test utilities for consistent testing across the suite
 * Provides mocking, cleanup, and isolation utilities
 */
class TestUtilities {
  constructor() {
    this.mockServices = new Map();
    this.resources = [];
    this.eventListeners = [];
    this.timers = [];
  }

  /**
   * Create a comprehensive mock service
   * @param {string} serviceName - Name of the service
   * @param {Object} methods - Methods to mock
   * @returns {Object} Mock service
   */
  createMockService(serviceName, methods = {}) {
    const mockService = {
      ...methods,
      // Add common methods if not provided
      getProjectOverview: methods.getProjectOverview || jest.fn().mockResolvedValue({}),
      getProjectHealth: methods.getProjectHealth || jest.fn().mockResolvedValue({}),
      getProgressAnalytics: methods.getProgressAnalytics || jest.fn().mockResolvedValue({}),
      getIncompleteWork: methods.getIncompleteWork || jest.fn().mockResolvedValue([]),
      getProjectContext: methods.getProjectContext || jest.fn().mockResolvedValue({}),
      getPortfolioContext: methods.getPortfolioContext || jest.fn().mockResolvedValue({}),
      getAllCachedRepositories: methods.getAllCachedRepositories || jest.fn().mockResolvedValue([])
    };

    this.mockServices.set(serviceName, mockService);
    return mockService;
  }

  /**
   * Get a mock service by name
   * @param {string} serviceName - Name of the service
   * @returns {Object} Mock service
   */
  getMockService(serviceName) {
    return this.mockServices.get(serviceName);
  }

  /**
   * Create a mock resource with cleanup
   * @param {*} data - Resource data
   * @param {Function} cleanupFn - Cleanup function
   * @returns {Object} Mock resource
   */
  createMockResource(data, cleanupFn = jest.fn()) {
    const resource = {
      data,
      cleanup: cleanupFn,
      id: Math.random().toString(36).substr(2, 9)
    };
    
    this.resources.push(resource);
    return resource;
  }

  /**
   * Add an event listener for cleanup tracking
   * @param {Object} element - DOM element or mock element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  addEventListener(element, event, handler) {
    this.eventListeners.push({ element, event, handler });
    if (element.addEventListener) {
      element.addEventListener(event, handler);
    }
  }

  /**
   * Create a timer and track it for cleanup
   * @param {Function} callback - Timer callback
   * @param {number} delay - Delay in milliseconds
   * @param {string} type - Timer type ('timeout' or 'interval')
   * @returns {number} Timer ID
   */
  createTimer(callback, delay, type = 'timeout') {
    let timerId;
    if (type === 'timeout') {
      timerId = setTimeout(callback, delay);
    } else {
      timerId = setInterval(callback, delay);
    }
    
    this.timers.push({ id: timerId, type, callback, delay });
    return timerId;
  }

  /**
   * Clean up all resources and event listeners
   */
  cleanup() {
    // Clean up resources
    this.resources.forEach(resource => {
      if (resource && typeof resource.cleanup === 'function') {
        try {
          resource.cleanup();
        } catch (error) {
          console.warn('Error cleaning up resource:', error);
        }
      }
    });
    this.resources = [];

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        try {
          element.removeEventListener(event, handler);
        } catch (error) {
          console.warn('Error removing event listener:', error);
        }
      }
    });
    this.eventListeners = [];

    // Clear timers
    this.timers.forEach(({ id, type }) => {
      try {
        if (type === 'timeout') {
          clearTimeout(id);
        } else {
          clearInterval(id);
        }
      } catch (error) {
        console.warn('Error clearing timer:', error);
      }
    });
    this.timers = [];

    // Clear mocks
    this.mockServices.forEach(service => {
      Object.values(service).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
          mockFn.mockClear();
        }
      });
    });
  }

  /**
   * Wait for all pending async operations
   * @returns {Promise} Promise that resolves when all operations complete
   */
  async waitForPendingOperations() {
    // Wait for next tick
    await new Promise(resolve => setImmediate(resolve));
    
    // Wait for any pending timers
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Create a mock AI service with all required methods
   * @returns {Object} Mock AI service
   */
  createMockAIService() {
    return this.createMockService('aiService', {
      chatCompletion: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Mock AI response' } }]
      }),
      getRecommendations: jest.fn().mockResolvedValue([]),
      analyzeProject: jest.fn().mockResolvedValue({}),
      getHealth: jest.fn().mockResolvedValue({ status: 'healthy' })
    });
  }

  /**
   * Create a mock session service
   * @returns {Object} Mock session service
   */
  createMockSessionService() {
    return this.createMockService('sessionService', {
      createSession: jest.fn().mockReturnValue({ id: 'test-session', messages: [] }),
      getSession: jest.fn().mockReturnValue({ id: 'test-session', messages: [] }),
      addMessage: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      cleanup: jest.fn()
    });
  }

  /**
   * Create a mock context service
   * @returns {Object} Mock context service
   */
  createMockContextService() {
    return this.createMockService('contextService', {
      getProjectContext: jest.fn().mockResolvedValue({ projectName: 'test', status: 'active' }),
      getPortfolioContext: jest.fn().mockResolvedValue({ projects: [] }),
      getQuickWinsContext: jest.fn().mockResolvedValue({ quickWins: [] }),
      getFocusAreasContext: jest.fn().mockResolvedValue({ focusAreas: [] })
    });
  }

  /**
   * Create a mock circuit breaker
   * @returns {Object} Mock circuit breaker
   */
  createMockCircuitBreaker() {
    return {
      execute: jest.fn().mockImplementation(async (operation, fn) => {
        return await fn();
      }),
      getState: jest.fn().mockReturnValue('CLOSED'),
      isOpen: jest.fn().mockReturnValue(false),
      reset: jest.fn()
    };
  }

  /**
   * Create a mock HTTP response
   * @param {Object} data - Response data
   * @param {number} status - HTTP status code
   * @returns {Object} Mock response
   */
  createMockResponse(data, status = 200) {
    return {
      status,
      json: jest.fn().mockResolvedValue(data),
      text: jest.fn().mockResolvedValue(JSON.stringify(data)),
      ok: status >= 200 && status < 300
    };
  }

  /**
   * Create a mock request object
   * @param {Object} body - Request body
   * @param {Object} params - Request parameters
   * @param {Object} query - Query parameters
   * @returns {Object} Mock request
   */
  createMockRequest(body = {}, params = {}, query = {}) {
    return {
      body,
      params,
      query,
      headers: {},
      method: 'POST'
    };
  }

  /**
   * Assert that all mocks were called as expected
   * @param {Object} mocks - Object containing mock functions
   */
  assertMocksCalled(mocks) {
    Object.entries(mocks).forEach(([name, mockFn]) => {
      if (jest.isMockFunction(mockFn)) {
        expect(mockFn).toHaveBeenCalled();
      }
    });
  }

  /**
   * Reset all mocks to initial state
   */
  resetAllMocks() {
    this.mockServices.forEach(service => {
      Object.values(service).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
          mockFn.mockReset();
        }
      });
    });
  }

  /**
   * Create a test environment with all necessary mocks
   * @returns {Object} Complete test environment
   */
  createTestEnvironment() {
    return {
      aiService: this.createMockAIService(),
      sessionService: this.createMockSessionService(),
      contextService: this.createMockContextService(),
      circuitBreaker: this.createMockCircuitBreaker(),
      getAllCachedRepositories: jest.fn().mockResolvedValue([])
    };
  }
}

// Export singleton instance
module.exports = new TestUtilities();
