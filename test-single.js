const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');

async function testDataIntegration() {
  console.log('🧪 Testing data integration...');
  
  // First, let's check what's in the cached repositories
  const { getAllCachedRepositories } = require('./notion');
  const cachedRepos = await getAllCachedRepositories();
  console.log('Cached repos count:', cachedRepos.length);
  console.log('First few repos:', cachedRepos.slice(0, 3).map(r => ({ name: r.name, repository: r.repository })));
  
  const projectService = new ProjectManagementService();
  const result = await projectService.gatherProjectData();
  
  console.log('Project names:', result.projectNames);
  console.log('GitHub data keys:', Object.keys(result.githubData));
  console.log('Notion data keys:', Object.keys(result.notionData));
  console.log('Cached data keys:', Object.keys(result.cachedData));
  
  // This should fail because githubData and notionData are empty
  try {
    assert(Object.keys(result.githubData).length > 0, 'Should have GitHub data - currently using empty object');
    console.log('✅ GitHub data test passed');
  } catch (error) {
    console.log('❌ GitHub data test failed:', error.message);
  }
  
  try {
    assert(Object.keys(result.notionData).length > 0, 'Should have Notion data - currently using empty object');
    console.log('✅ Notion data test passed');
  } catch (error) {
    console.log('❌ Notion data test failed:', error.message);
  }
}

testDataIntegration().catch(console.error);
