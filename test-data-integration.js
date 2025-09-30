/**
 * Data Integration Test Suite
 * Tests real data integration for Epic 9 services
 */

const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');
const ProgressTrackingService = require('./services/progress-tracking-service');

async function runDataIntegrationTests() {
  console.log('🧪 Running Data Integration Tests...\n');
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  function test(name, testFn) {
    testsTotal++;
    try {
      testFn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
  
  const projectService = new ProjectManagementService();
  const progressService = new ProgressTrackingService();

  // Test 1: Real data integration
  test('should fetch real project data from GitHub and Notion', async () => {
    const result = await projectService.gatherProjectData();
    
    // Should have real data sources, not just cached data
    assert(result, 'Should have result object');
    assert(result.githubData, 'Should have githubData');
    assert(result.notionData, 'Should have notionData');
    assert(result.commitLogData, 'Should have commitLogData');
    
    // Debug: Log what we actually have
    console.log('GitHub data keys:', Object.keys(result.githubData));
    console.log('Notion data keys:', Object.keys(result.notionData));
    console.log('Cached data keys:', Object.keys(result.cachedData));
    
    // Should have actual project data, not just empty objects
    // This test should FAIL because current implementation uses empty objects
    assert(Object.keys(result.githubData).length > 0, 'Should have GitHub data - currently using empty object');
    assert(Object.keys(result.notionData).length > 0, 'Should have Notion data - currently using empty object');
  });

  // Test 2: Real health score calculation
  test('should calculate real health scores based on actual metrics', async () => {
    const result = await projectService.getProjectOverview();
    
    assert(result.success, 'Should return success');
    assert(result.data, 'Should have data');
    assert(Array.isArray(result.data), 'Data should be array');
    
    // Each project should have a meaningful health score
    result.data.forEach(project => {
      assert(project.healthScore !== undefined, 'Should have health score');
      assert(typeof project.healthScore === 'number', 'Health score should be number');
      assert(project.healthScore >= 0, 'Health score should be >= 0');
      assert(project.healthScore <= 100, 'Health score should be <= 100');
      
      // Health score should be based on real metrics, not just mock data
      assert(project.healthFactors, 'Should have health factors');
      assert(project.healthFactors.activity, 'Should have activity factor');
      assert(project.healthFactors.commits, 'Should have commits factor');
      assert(project.healthFactors.prs, 'Should have PRs factor');
    });
  });

  // Test 3: Real velocity trends calculation
  test('should calculate real velocity trends from historical data', async () => {
    const result = await progressService.calculateVelocityTrends();
    
    assert(result.overall, 'Should have overall trends');
    assert(result.overall.trend, 'Should have trend');
    assert(result.overall.velocity !== undefined, 'Should have velocity');
    assert(result.overall.change !== undefined, 'Should have change');
    
    // Should have actual velocity data, not just static values
    assert(result.overall.velocity > 0, 'Should have positive velocity');
    assert(result.projects, 'Should have projects array');
    assert(Array.isArray(result.projects), 'Projects should be array');
    
    // Each project should have meaningful velocity data
    result.projects.forEach(project => {
      assert(project.velocity !== undefined, 'Project should have velocity');
      assert(typeof project.velocity === 'number', 'Velocity should be number');
      assert(project.velocity >= 0, 'Velocity should be >= 0');
    });
  });

  // Test 4: Real blocked and stale items identification
  test('should identify real blocked and stale items', async () => {
    const result = await progressService.getProgressAnalytics();
    
    assert(result.success, 'Should return success');
    assert(result.data, 'Should have data');
    
    // Should have blocked items data
    assert(result.data.blockedItems !== undefined, 'Should have blocked items');
    assert(Array.isArray(result.data.blockedItems), 'Blocked items should be array');
    
    // Should have stale items data
    assert(result.data.staleItems !== undefined, 'Should have stale items');
    assert(Array.isArray(result.data.staleItems), 'Stale items should be array');
    
    // If there are blocked/stale items, they should have proper structure
    if (result.data.blockedItems.length > 0) {
      result.data.blockedItems.forEach(item => {
        assert(item.id, 'Blocked item should have id');
        assert(item.title, 'Blocked item should have title');
        assert(item.reason, 'Blocked item should have reason');
        assert(item.lastActivity, 'Blocked item should have last activity');
        assert(item.daysBlocked !== undefined, 'Blocked item should have days blocked');
      });
    }
  });

  // Test 5: Pagination support
  test('should provide meaningful pagination metadata', async () => {
    const result = await projectService.getProjectOverview({ page: 1, limit: 10 });
    
    assert(result.success, 'Should return success');
    assert(result.data, 'Should have data');
    assert(result.pagination, 'Should have pagination metadata');
    
    // Should have proper pagination metadata
    assert(result.pagination.page === 1, 'Should have correct page');
    assert(result.pagination.limit === 10, 'Should have correct limit');
    assert(result.pagination.total !== undefined, 'Should have total count');
    assert(result.pagination.totalPages !== undefined, 'Should have total pages');
    assert(result.pagination.hasNext !== undefined, 'Should have hasNext flag');
    assert(result.pagination.hasPrev !== undefined, 'Should have hasPrev flag');
    
    // Data should be limited to requested page size
    assert(result.data.length <= 10, 'Data should be limited to page size');
  });

  console.log(`\n📊 Data Integration Tests Complete: ${testsPassed}/${testsTotal} passed`);
  return { testsPassed, testsTotal };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDataIntegrationTests()
    .then(({ testsPassed, testsTotal }) => {
      process.exit(testsPassed === testsTotal ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runDataIntegrationTests };
