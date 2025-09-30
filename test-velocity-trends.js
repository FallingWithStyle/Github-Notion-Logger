const assert = require('assert');
const ProgressTrackingService = require('./services/progress-tracking-service');

async function testVelocityTrendsCalculation() {
  console.log('🧪 Testing velocity trends calculation...');
  
  const progressService = new ProgressTrackingService();
  const result = await progressService.calculateVelocityTrends();
  
  console.log('Velocity trends result:', JSON.stringify(result, null, 2));
  
  // Test that velocity trends are calculated from real data
  try {
    assert(result.overall !== undefined, 'Should have overall trends');
    assert(result.overall.trend !== undefined, 'Should have trend');
    assert(result.overall.velocity !== undefined, 'Should have velocity');
    assert(result.overall.change !== undefined, 'Should have change');
    
    // Should have actual velocity data, not just static values
    assert(result.overall.velocity > 0, 'Should have positive velocity');
    assert(result.projects !== undefined, 'Should have projects array');
    assert(Array.isArray(result.projects), 'Projects should be array');
    
    // Each project should have meaningful velocity data
    if (result.projects.length > 0) {
      result.projects.forEach(project => {
        assert(project.velocity !== undefined, 'Project should have velocity');
        assert(typeof project.velocity === 'number', 'Velocity should be number');
        assert(project.velocity >= 0, 'Velocity should be >= 0');
        assert(project.trend !== undefined, 'Project should have trend');
        assert(project.change !== undefined, 'Project should have change');
      });
    }
    
    // Should have historical data analysis, not just static values
    assert(result.overall.trend !== 'stable', 'Should not return static stable trend');
    assert(result.overall.change !== 0, 'Should not return static zero change');
    
    console.log('✅ Velocity trends test passed');
  } catch (error) {
    console.log('❌ Velocity trends test failed:', error.message);
  }
}

testVelocityTrendsCalculation().catch(console.error);
