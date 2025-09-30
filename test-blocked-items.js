const assert = require('assert');
const ProgressTrackingService = require('./services/progress-tracking-service');

async function testBlockedItemsDetection() {
  console.log('🧪 Testing blocked and stale items detection...');
  
  const progressService = new ProgressTrackingService();
  const result = await progressService.getProgressAnalytics();
  
  console.log('Progress analytics result:', JSON.stringify(result, null, 2));
  
  // Test that blocked and stale items are properly identified
  try {
    assert(result.success, 'Should return success');
    assert(result.data, 'Should have data');
    
    // Should have projects with blocked and stale items
    assert(result.data.projects, 'Should have projects array');
    assert(Array.isArray(result.data.projects), 'Projects should be array');
    assert(result.data.projects.length > 0, 'Should have at least one project');
    
    // Check that projects have blocked and stale items
    let totalBlockedItems = 0;
    let totalStaleItems = 0;
    
    result.data.projects.forEach(project => {
      assert(project.blockedItems !== undefined, 'Project should have blocked items');
      assert(Array.isArray(project.blockedItems), 'Project blocked items should be array');
      assert(project.staleItems !== undefined, 'Project should have stale items');
      assert(Array.isArray(project.staleItems), 'Project stale items should be array');
      
      totalBlockedItems += project.blockedItems.length;
      totalStaleItems += project.staleItems.length;
      
      // If there are blocked items, they should have proper structure
      project.blockedItems.forEach(item => {
        assert(item.id, 'Blocked item should have id');
        assert(item.title, 'Blocked item should have title');
        assert(item.type, 'Blocked item should have type');
        assert(item.reason, 'Blocked item should have reason');
        assert(item.lastActivity, 'Blocked item should have last activity');
        assert(item.daysBlocked !== undefined, 'Blocked item should have days blocked');
        assert(typeof item.daysBlocked === 'number', 'Days blocked should be number');
        assert(item.daysBlocked > 0, 'Days blocked should be positive');
        assert(item.priority !== undefined, 'Blocked item should have priority');
        assert(typeof item.priority === 'number', 'Priority should be number');
      });
      
      // If there are stale items, they should have proper structure
      project.staleItems.forEach(item => {
        assert(item.id, 'Stale item should have id');
        assert(item.title, 'Stale item should have title');
        assert(item.type, 'Stale item should have type');
        assert(item.reason, 'Stale item should have reason');
        assert(item.lastActivity, 'Stale item should have last activity');
        assert(item.daysStale !== undefined, 'Stale item should have days stale');
        assert(typeof item.daysStale === 'number', 'Days stale should be number');
        assert(item.daysStale > 0, 'Days stale should be positive');
        assert(item.priority !== undefined, 'Stale item should have priority');
        assert(typeof item.priority === 'number', 'Priority should be number');
      });
    });
    
    // Should have some blocked or stale items (not just empty arrays)
    const totalProblematicItems = totalBlockedItems + totalStaleItems;
    assert(totalProblematicItems > 0, 'Should identify some blocked or stale items');
    
    console.log(`   - Total blocked items: ${totalBlockedItems}`);
    console.log(`   - Total stale items: ${totalStaleItems}`);
    console.log(`   - Projects with blocked items: ${result.data.aggregate.projectsWithBlockedItems}`);
    console.log(`   - Projects with stale items: ${result.data.aggregate.projectsWithStaleItems}`);
    
    console.log('✅ Blocked items test passed');
  } catch (error) {
    console.log('❌ Blocked items test failed:', error.message);
  }
}

testBlockedItemsDetection().catch(console.error);
