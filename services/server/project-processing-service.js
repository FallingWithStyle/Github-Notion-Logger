const { Client } = require('@notionhq/client');

// Helper function to extract stories from PRD content
function extractStoriesFromContent(content, projectName) {
  const stories = [];
  const lines = content.split('\n');
  
  // Better story extraction patterns - focus on actual story titles
  const storyPatterns = [
    // Epic headers: ## Epic 1: [Story Title]
    /^#{1,3}\s+Epic\s+\d+:\s*(.+)$/gm,
    // Story headers: #### Story 1.1: [Story Title]
    /^#{1,6}\s+Story\s+\d+\.\d+:\s*(.+)$/gm,
    // User Story format: As a [user], I want [action], so that [benefit]
    /^As\s+a\s+([^,]+),\s+I\s+want\s+([^,]+),\s+so\s+that\s+(.+)$/gm,
    // Feature headers: ### [Feature Name]
    /^#{1,3}\s+([^#\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
    // Bullet points with meaningful content (not just status)
    /^[-*]\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm,
    // Numbered lists with meaningful content
    /^\d+\.\s+([A-Z][^-\n]+?)(?:\s*[-–—]\s*([^\n]+))?$/gm
  ];
  
  // Common PRD section headers to exclude from story extraction
  const sectionHeaderPatterns = [
    /^\d+\.\s+(Executive Summary|Goals and Background Context|Requirements|User Experience|Technical Specifications|Constraints and Assumptions|Success Criteria|Timeline and Milestones|Appendices|Project Metadata|Template Usage Notes)/i,
    /^(Executive Summary|Goals and Background Context|Requirements|User Experience|Technical Specifications|Constraints and Assumptions|Success Criteria|Timeline and Milestones|Appendices|Project Metadata|Template Usage Notes)$/i,
    /^\d+\.\d+\s+(Functional Requirements|Non-Functional Requirements)/i,
    /^(Functional Requirements|Non-Functional Requirements)$/i,
    /^\d+\.\s+[A-Z][a-z]+\s+(and|&)\s+[A-Z][a-z]+/i, // Pattern like "Goals and Background Context"
    /^\d+\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i, // Pattern like "Executive Summary"
    /^[A-Z]{2,3}\d*:/i, // Pattern like "FR1:", "NFR1:", "AC1:"
    /^\d+\.\d+\s+[A-Z]/i, // Pattern like "3.2 Non" (incomplete section headers)
    /^Project\s+[A-Z]/i, // Pattern like "Project Title Here"
    /^Epic\s+\d+:/i, // Pattern like "Epic 1:" (should be handled by epic pattern)
    /^[A-Z][a-z]+\s+[A-Z]+\s+[A-Z]+$/i // Pattern like "Test Project PRD"
  ];
  
  // Status indicators to avoid extracting as titles
  const statusOnlyWords = ['IMPLEMENTED', 'DESIGNED', 'PLANNED', 'REVIEW', 'ACTIVE', 'DONE', 'TODO', 'IN PROGRESS'];
  
  // Priority indicators
  const priorityIndicators = {
    'HIGH': 1,
    'MEDIUM': 2,
    'LOW': 3,
    'P0': 1,
    'P1': 2,
    'P2': 3,
    'P3': 4,
    'CRITICAL': 1,
    'IMPORTANT': 2,
    'NICE-TO-HAVE': 3
  };
  
  // Story points indicators
  const storyPointsIndicators = {
    'XS': 1,
    'S': 2,
    'M': 3,
    'L': 5,
    'XL': 8,
    'XXL': 13,
    '1': 1,
    '2': 2,
    '3': 3,
    '5': 5,
    '8': 8,
    '13': 13
  };
  
  // Process each pattern
  storyPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let title = match[1] || match[0];
      let description = match[2] || '';
      
      // Clean up the title
      title = title.trim().replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      
      // Skip if it's just a status indicator
      if (statusOnlyWords.some(word => title.toUpperCase().includes(word) && title.length < 50)) {
        continue;
      }
      
      // Skip if it matches section header patterns
      if (sectionHeaderPatterns.some(pattern => pattern.test(title))) {
        continue;
      }
      
      // Skip very short titles (likely not meaningful stories)
      if (title.length < 10) {
        continue;
      }
      
      // Skip if it's just a number or very basic text
      if (/^\d+$/.test(title) || /^[A-Z]{1,3}$/.test(title)) {
        continue;
      }
      
      // Extract priority from title or description
      let priority = 2; // Default medium priority
      const priorityText = (title + ' ' + description).toUpperCase();
      for (const [indicator, value] of Object.entries(priorityIndicators)) {
        if (priorityText.includes(indicator)) {
          priority = value;
          break;
        }
      }
      
      // Extract story points from title or description
      let storyPoints = 'M'; // Default medium
      for (const [indicator, value] of Object.entries(storyPointsIndicators)) {
        if (priorityText.includes(indicator)) {
          storyPoints = indicator;
          break;
        }
      }
      
      // Determine status based on content
      let status = 'planned';
      const statusText = (title + ' ' + description).toUpperCase();
      if (statusText.includes('IMPLEMENTED') || statusText.includes('DONE') || statusText.includes('COMPLETE')) {
        status = 'completed';
      } else if (statusText.includes('IN PROGRESS') || statusText.includes('ACTIVE') || statusText.includes('DEVELOPING')) {
        status = 'in-progress';
      } else if (statusText.includes('REVIEW') || statusText.includes('TESTING')) {
        status = 'review';
      } else if (statusText.includes('BLOCKED') || statusText.includes('WAITING')) {
        status = 'blocked';
      }
      
      stories.push({
        title: title,
        description: description,
        priority: priority,
        storyPoints: storyPoints,
        status: status,
        projectName: projectName
      });
    }
  });
  
  // Remove duplicates based on title similarity
  const uniqueStories = [];
  stories.forEach(story => {
    const isDuplicate = uniqueStories.some(existing => 
      existing.title.toLowerCase() === story.title.toLowerCase() ||
      (existing.title.length > 20 && story.title.length > 20 && 
       existing.title.toLowerCase().includes(story.title.toLowerCase().substring(0, 20))) ||
      (story.title.length > 20 && existing.title.length > 20 && 
       story.title.toLowerCase().includes(existing.title.toLowerCase().substring(0, 20)))
    );
    
    if (!isDuplicate) {
      uniqueStories.push(story);
    }
  });
  
  return uniqueStories;
}

// Function to store project progress in Notion
async function storeProjectProgressInNotion(repositoryData) {
  try {
    console.log(`📊 Storing project progress for ${repositoryData.name}...`);
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_PROJECT_PROGRESS_DATABASE_ID;
    
    if (!databaseId) {
      console.log('⚠️ NOTION_PROJECT_PROGRESS_DATABASE_ID not set, skipping project progress storage');
      return;
    }
    
    // Check if project already exists
    const existingProjects = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Repository',
        rich_text: {
          equals: repositoryData.name
        }
      }
    });
    
    const projectData = {
      Repository: {
        rich_text: [{ text: { content: repositoryData.name } }]
      },
      'Total Commits': {
        number: repositoryData.totalCommits
      },
      'Last Activity': {
        date: { start: repositoryData.lastActivity }
      },
      'Project Health': {
        select: { name: repositoryData.health }
      },
      'Progress': {
        number: repositoryData.progress
      },
      'Last Updated': {
        date: { start: new Date().toISOString().split('T')[0] }
      }
    };
    
    if (existingProjects.results.length > 0) {
      // Update existing project
      await notion.pages.update({
        page_id: existingProjects.results[0].id,
        properties: projectData
      });
      console.log(`✅ Updated project progress for ${repositoryData.name}`);
    } else {
      // Create new project
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: projectData
      });
      console.log(`✅ Created project progress for ${repositoryData.name}`);
    }
    
  } catch (error) {
    console.error(`❌ Error storing project progress for ${repositoryData.name}:`, error);
  }
}

// Function to store stories in Notion
async function storeStoriesInNotion(stories, repositoryName) {
  try {
    console.log(`📚 Storing ${stories.length} stories for ${repositoryName}...`);
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_STORY_PROGRESS_DATABASE_ID;
    
    if (!databaseId) {
      console.log('⚠️ NOTION_STORY_PROGRESS_DATABASE_ID not set, skipping story storage');
      return;
    }
    
    // Batch create pages (Notion allows up to 100 pages per request)
    const batchSize = 100;
    for (let i = 0; i < stories.length; i += batchSize) {
      const batch = stories.slice(i, i + batchSize);
      
      const pages = batch.map(story => ({
        parent: { database_id: databaseId },
        properties: {
          'Story Title': {
            title: [{ text: { content: story.title } }]
          },
          'Project Name': {
            rich_text: [{ text: { content: story.projectName } }]
          },
          'Status': {
            select: { name: story.status }
          },
          'Priority': {
            number: story.priority
          },
          'Story Points': {
            select: { name: story.storyPoints }
          },
          'Repository': {
            rich_text: [{ text: { content: repositoryName } }]
          },
          'Notes': {
            rich_text: [{ text: { content: story.description } }]
          },
          'Created': {
            date: { start: new Date().toISOString().split('T')[0] }
          },
          'Last Updated': {
            date: { start: new Date().toISOString().split('T')[0] }
          }
        }
      }));
      
      await notion.pages.create({ pages });
      console.log(`✅ Stored batch of ${batch.length} stories for ${repositoryName}`);
    }
    
  } catch (error) {
    console.error(`❌ Error storing stories for ${repositoryName}:`, error);
  }
}

// Function to ensure project progress database exists
async function ensureProjectProgressDatabase() {
  try {
    console.log('🔄 Ensuring project progress database exists...');
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_PROJECT_PROGRESS_DATABASE_ID;
    
    if (!databaseId) {
      console.log('⚠️ NOTION_PROJECT_PROGRESS_DATABASE_ID not set, skipping database check');
      return;
    }
    
    // Check if database exists and has correct schema
    try {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      console.log('✅ Project progress database exists and is accessible');
      return databaseId;
    } catch (error) {
      console.error('❌ Error accessing project progress database:', error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error ensuring project progress database:', error);
    return null;
  }
}

// Function to ensure story progress database exists
async function ensureStoryProgressDatabase() {
  try {
    console.log('🔄 Ensuring story progress database exists...');
    
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_STORY_PROGRESS_DATABASE_ID;
    
    if (!databaseId) {
      console.log('⚠️ NOTION_STORY_PROGRESS_DATABASE_ID not set, skipping database check');
      return;
    }
    
    // Check if database exists and has correct schema
    try {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      console.log('✅ Story progress database exists and is accessible');
      return databaseId;
    } catch (error) {
      console.error('❌ Error accessing story progress database:', error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error ensuring story progress database:', error);
    return null;
  }
}

module.exports = {
  extractStoriesFromContent,
  storeProjectProgressInNotion,
  storeStoriesInNotion,
  ensureProjectProgressDatabase,
  ensureStoryProgressDatabase
};
