const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');

async function testHealthScoreCalculation() {
  console.log('🧪 Testing health score calculation...');
  
  const projectService = new ProjectManagementService();
  const result = await projectService.getProjectOverview();
  
  console.log('Projects count:', result.data.length);
  
  if (result.data.length > 0) {
    const firstProject = result.data[0];
    console.log('First project:', firstProject.name);
    console.log('Health score:', firstProject.health?.healthScore);
    console.log('Health data:', firstProject.health);
    console.log('Full project data:', JSON.stringify(firstProject, null, 2));
    
    // Test that health score is calculated based on real metrics
    try {
      assert(firstProject.health !== undefined, 'Should have health object');
      assert(firstProject.health.healthScore !== undefined, 'Should have health score');
      assert(typeof firstProject.health.healthScore === 'number', 'Health score should be number');
      assert(firstProject.health.healthScore >= 0, 'Health score should be >= 0');
      assert(firstProject.health.healthScore <= 100, 'Health score should be <= 100');
      
      // Health data should have meaningful values
      assert(firstProject.health.prdStatus !== undefined, 'Should have PRD status');
      assert(firstProject.health.taskListStatus !== undefined, 'Should have task list status');
      assert(firstProject.health.completionVelocity !== undefined, 'Should have completion velocity');
      assert(firstProject.health.healthStatus !== undefined, 'Should have health status');
      
      // Health factors should be based on real data
      assert(firstProject.health.healthFactors !== undefined, 'Should have health factors');
      assert(firstProject.health.healthFactors.activity !== undefined, 'Should have activity factor');
      assert(firstProject.health.healthFactors.commits !== undefined, 'Should have commits factor');
      assert(firstProject.health.healthFactors.prs !== undefined, 'Should have PRs factor');
      assert(firstProject.health.healthFactors.issues !== undefined, 'Should have issues factor');
      assert(firstProject.health.healthFactors.documentation !== undefined, 'Should have documentation factor');
      assert(firstProject.health.healthFactors.prd !== undefined, 'Should have PRD factor');
      
      // Health factors should be meaningful (not just 0)
      const totalFactors = Object.values(firstProject.health.healthFactors).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
      assert(totalFactors > 0, 'Health factors should have meaningful values');
      
      console.log('✅ Health score test passed');
    } catch (error) {
      console.log('❌ Health score test failed:', error.message);
    }
  } else {
    console.log('❌ No projects found to test');
  }
}

testHealthScoreCalculation().catch(console.error);
