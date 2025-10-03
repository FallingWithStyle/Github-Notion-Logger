/**
 * Test environment setup and configuration
 * Ensures consistent test environment across all tests
 */
const testUtils = require('./test-utilities');

// Global test environment setup
beforeAll(async () => {
  // Set up global test environment
  global.testUtils = testUtils;
  
  // Mock console methods to prevent logging during tests
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };

  // Set up global error handling
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Mock external dependencies that might be missing
  global.getAllCachedRepositories = jest.fn().mockResolvedValue([]);
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // Reset test utilities
  testUtils.cleanup();
});

afterEach(async () => {
  // Wait for any pending operations
  await testUtils.waitForPendingOperations();
  
  // Clean up test utilities
  testUtils.cleanup();
  
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterAll(async () => {
  // Final cleanup
  await testUtils.waitForPendingOperations();
  testUtils.cleanup();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Export test utilities for use in individual tests
module.exports = testUtils;
