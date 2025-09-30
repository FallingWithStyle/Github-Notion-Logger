const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');

async function testPaginationImplementation() {
  console.log('🧪 Testing pagination implementation...');
  
  const projectService = new ProjectManagementService();
  
  // Test pagination with different page sizes
  const testCases = [
    { page: 1, limit: 5, expectedCount: 5 },
    { page: 2, limit: 10, expectedCount: 10 },
    { page: 3, limit: 15, expectedCount: 15 },
    { page: 1, limit: 50, expectedCount: 29 } // All projects
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📄 Testing page ${testCase.page} with limit ${testCase.limit}...`);
    
    try {
      const result = await projectService.getProjectOverview({
        page: testCase.page,
        limit: testCase.limit
      });
      
      console.log('Pagination result:', JSON.stringify(result, null, 2));
      
      // Test that pagination metadata is present
      assert(result.success, 'Should return success');
      assert(result.data, 'Should have data');
      assert(result.metadata, 'Should have metadata');
      assert(result.metadata.pagination, 'Should have pagination metadata');
      
      const pagination = result.metadata.pagination;
      assert(typeof pagination.page === 'number', 'Page should be a number');
      assert(typeof pagination.limit === 'number', 'Limit should be a number');
      assert(typeof pagination.total === 'number', 'Total should be a number');
      assert(typeof pagination.totalPages === 'number', 'Total pages should be a number');
      assert(typeof pagination.hasNext === 'boolean', 'Has next should be boolean');
      assert(typeof pagination.hasPrev === 'boolean', 'Has prev should be boolean');
      
      // Test that pagination values are correct
      assert(pagination.page === testCase.page, `Page should be ${testCase.page}`);
      assert(pagination.limit === testCase.limit, `Limit should be ${testCase.limit}`);
      assert(pagination.total > 0, 'Total should be greater than 0');
      assert(pagination.totalPages > 0, 'Total pages should be greater than 0');
      
      // Test that the correct number of items are returned
      const actualCount = Array.isArray(result.data) ? result.data.length : 0;
      const startIndex = (testCase.page - 1) * testCase.limit;
      const expectedCount = startIndex >= pagination.total ? 0 : Math.min(testCase.limit, pagination.total - startIndex);
      assert(actualCount === expectedCount, 
        `Expected ${expectedCount} items, got ${actualCount} for page ${testCase.page} with limit ${testCase.limit} (startIndex: ${startIndex}, total: ${pagination.total})`);
      
      // Test pagination navigation
      if (testCase.page > 1) {
        assert(pagination.hasPrev === true, 'Should have previous page when page > 1');
      } else {
        assert(pagination.hasPrev === false, 'Should not have previous page when page = 1');
      }
      
      if (testCase.page < pagination.totalPages) {
        assert(pagination.hasNext === true, 'Should have next page when not on last page');
      } else {
        assert(pagination.hasNext === false, 'Should not have next page when on last page');
      }
      
      console.log(`✅ Pagination test passed for page ${testCase.page} with limit ${testCase.limit}`);
      console.log(`   - Items returned: ${actualCount}`);
      console.log(`   - Total items: ${pagination.total}`);
      console.log(`   - Total pages: ${pagination.totalPages}`);
      console.log(`   - Has next: ${pagination.hasNext}`);
      console.log(`   - Has prev: ${pagination.hasPrev}`);
      
    } catch (error) {
      console.log(`❌ Pagination test failed for page ${testCase.page} with limit ${testCase.limit}:`, error.message);
      return;
    }
  }
  
  console.log('\n✅ All pagination tests passed');
}

testPaginationImplementation().catch(console.error);
