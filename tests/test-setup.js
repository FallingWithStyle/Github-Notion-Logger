/**
 * Test setup file to configure test environment and provide utilities
 * Fixes Jest worker exceptions, async cleanup issues, and test isolation problems
 */

// Global test utilities
global.testUtils = {
  /**
   * Create a mock service with specified methods
   * @param {Array<string>} methods - Array of method names
   * @returns {Object} Mock service object
   */
  createMockService: (methods) => {
    const mock = {};
    methods.forEach(method => {
      mock[method] = jest.fn().mockResolvedValue({});
    });
    return mock;
  },

  /**
   * Create a mock resource with cleanup method
   * @param {*} data - Resource data
   * @returns {Object} Mock resource object
   */
  createMockResource: (data) => ({
    data,
    cleanup: jest.fn()
  }),

  /**
   * Wait for all pending promises to resolve
   * @returns {Promise} Promise that resolves when all pending operations complete
   */
  waitForPendingPromises: () => new Promise(resolve => setImmediate(resolve)),

  /**
   * Clear all timers and mocks
   */
  cleanup: () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  },

  /**
   * Create a comprehensive mock service
   * @param {string} serviceName - Name of the service
   * @param {Object} methods - Methods to mock
   * @returns {Object} Mock service
   */
  createMockServiceWithMethods: (serviceName, methods = {}) => {
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

    return mockService;
  },

  /**
   * Create a mock AI service with all required methods
   * @returns {Object} Mock AI service
   */
  createMockAIService: () => ({
    chatCompletion: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Mock AI response' } }]
    }),
    getRecommendations: jest.fn().mockResolvedValue([]),
    analyzeProject: jest.fn().mockResolvedValue({}),
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy' })
  }),

  /**
   * Create a mock session service
   * @returns {Object} Mock session service
   */
  createMockSessionService: () => ({
    createSession: jest.fn().mockReturnValue({ id: 'test-session', messages: [] }),
    getSession: jest.fn().mockReturnValue({ id: 'test-session', messages: [] }),
    addMessage: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    cleanup: jest.fn()
  }),

  /**
   * Create a mock context service
   * @returns {Object} Mock context service
   */
  createMockContextService: () => ({
    getProjectContext: jest.fn().mockResolvedValue({ projectName: 'test', status: 'active' }),
    getPortfolioContext: jest.fn().mockResolvedValue({ projects: [] }),
    getQuickWinsContext: jest.fn().mockResolvedValue({ quickWins: [] }),
    getFocusAreasContext: jest.fn().mockResolvedValue({ focusAreas: [] })
  })
};

// Mock external dependencies that might be missing
global.getAllCachedRepositories = jest.fn().mockResolvedValue([]);

// Mock console methods to prevent logging during tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Setup global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Setup global cleanup
afterAll(async () => {
  // Wait for any pending operations
  await global.testUtils.waitForPendingPromises();
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Restore original console
  global.console = originalConsole;
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Global beforeEach and afterEach for all tests
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(async () => {
  // Wait for any pending operations
  await global.testUtils.waitForPendingPromises();
  
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.clearAllTimers();
});