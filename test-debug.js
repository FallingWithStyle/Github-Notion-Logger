const ProjectManagementService = require('./services/project-management-service');

async function debugData() {
  console.log('🔍 Debugging data integration...');
  
  try {
    const projectService = new ProjectManagementService();
    const result = await projectService.gatherProjectData();
    
    console.log('Result type:', typeof result);
    console.log('Result:', result);
    
    if (result && result.sources) {
      console.log('Sources object:', result.sources);
      console.log('GitHub data keys:', Object.keys(result.sources.githubData));
      console.log('Notion data keys:', Object.keys(result.sources.notionData));
      console.log('Cached data keys:', Object.keys(result.sources.cachedData));
      console.log('Project names:', result.sources.projectNames);
      
      if (result.sources.projectNames.length > 0) {
        const firstProject = result.sources.cachedData[result.sources.projectNames[0]];
        console.log('First project data:', firstProject);
      }
    } else {
      console.log('❌ Result or sources is undefined');
    }
  } catch (error) {
    console.error('❌ Error in debugData:', error);
  }
}

debugData().catch(console.error);
