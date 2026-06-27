/**
 * Test Performance Optimization for Epic 9 QA Issues
 * Tests parallel processing and timeout handling
 */

// Set up mocks before requiring services
jest.mock('./notion', () => require('./__mocks__/notion'));
jest.mock('@notionhq/client', () => ({
  Client: jest.fn(() => ({
    databases: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'test-database-id',
        title: [{ plain_text: 'Test Database' }]
      })
    }
  }))
}));

const ProjectManagementService = require('./services/project-management-service');
const ProgressTrackingService = require('./services/progress-tracking-service');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Performance Optimization Tests...\n');
    
    for (const test of this.tests) {
      try {
        console.log(`Running: ${test.name}`);
        await test.fn();
        console.log(`✅ PASSED: ${test.name}\n`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// Test: Parallel Processing
runner.test('should process multiple projects in parallel to avoid timeout', async () => {
  const projectService = new ProjectManagementService();
  const startTime = Date.now();
  
  // This should complete within 5 seconds, not 30+ seconds
  const result = await projectService.getProjectOverview({
    parallel: true,
    timeout: 5000 // 5 second timeout
  });
  
  const duration = Date.now() - startTime;
  
  if (!result.success) {
    throw new Error(`Expected success=true, got ${result.success}`);
  }
  
  if (duration >= 5000) {
    throw new Error(`Expected duration < 5000ms, got ${duration}ms`);
  }
  
  if (!result.data || !Array.isArray(result.data)) {
    throw new Error(`Expected data array, got ${typeof result.data}`);
  }
});

// Test: Concurrent Requests
runner.test('should handle concurrent requests without header errors', async () => {
  const projectService = new ProjectManagementService();
  const promises = [];
  
  // Make 5 concurrent requests
  for (let i = 0; i < 5; i++) {
    promises.push(projectService.getProjectOverview({ page: i + 1 }));
  }
  
  const results = await Promise.all(promises);
  
  // All requests should succeed
  for (let i = 0; i < results.length; i++) {
    if (!results[i].success) {
      throw new Error(`Request ${i + 1} failed: ${results[i].error || 'Unknown error'}`);
    }
    if (!results[i].data) {
      throw new Error(`Request ${i + 1} missing data`);
    }
  }
  
  if (results.length !== 5) {
    throw new Error(`Expected 5 results, got ${results.length}`);
  }
});

// Test: Pagination
runner.test('should implement proper pagination to handle large datasets', async () => {
  const projectService = new ProjectManagementService();
  const result = await projectService.getProjectOverview({
    page: 1,
    limit: 10,
    parallel: true
  });
  
  if (!result.success) {
    throw new Error(`Expected success=true, got ${result.success}`);
  }
  
  if (!result.data) {
    throw new Error('Expected data property');
  }
  
  if (!result.metadata || !result.metadata.pagination) {
    throw new Error('Expected pagination property in metadata');
  }
  
  if (result.metadata.pagination.page !== 1) {
    throw new Error(`Expected page=1, got ${result.metadata.pagination.page}`);
  }
  
  if (result.metadata.pagination.limit !== 10) {
    throw new Error(`Expected limit=10, got ${result.metadata.pagination.limit}`);
  }
});

// Test: Cache Performance
runner.test('should use cache effectively to avoid repeated API calls', async () => {
  const projectService = new ProjectManagementService();
  const startTime = Date.now();
  
  // First call - should hit API
  const result1 = await projectService.getProjectOverview();
  const firstCallTime = Date.now() - startTime;
  
  // Second call - should hit cache
  const cacheStartTime = Date.now();
  const result2 = await projectService.getProjectOverview();
  const cacheCallTime = Date.now() - cacheStartTime;
  
  if (!result1.success) {
    throw new Error(`First call failed: ${result1.error || 'Unknown error'}`);
  }
  
  if (!result2.success) {
    throw new Error(`Second call failed: ${result2.error || 'Unknown error'}`);
  }
  
  if (!result2.metadata || !result2.metadata.cached) {
    throw new Error('Second call should be cached');
  }
  
  if (cacheCallTime >= firstCallTime) {
    throw new Error(`Cache call (${cacheCallTime}ms) should be faster than first call (${firstCallTime}ms)`);
  }
});

// Run tests
async function runTests() {
  try {
    const success = await runner.run();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

runTests();