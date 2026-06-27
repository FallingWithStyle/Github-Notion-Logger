const express = require('express');
const router = express.Router();

// Helper function for async error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Cache for progress data
const progressCache = new Map();

// GET /api/prd-stories - Get all PRD stories with filtering
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { projectName, status } = req.query;
    
    console.log(`📊 Fetching PRD stories${projectName ? ` for project ${projectName}` : ''}${status ? ` with status ${status}` : ''}...`);
    
    const { getPrdStoryData } = require('../notion');
    const allStories = await getPrdStoryData(projectName, status);
    
    // Filter to only use the latest PRD version for each project
    const latestProjectVersions = new Map();
    const filteredStories = [];
    
    // Group stories by base project name (without version info)
    allStories.forEach(story => {
      const baseProjectName = story.projectName.replace(/\s+v?\d+(\.\d+)?\s*$/i, '').trim();
      const storyDate = new Date(story.created || story.lastUpdated);
      
      if (!latestProjectVersions.has(baseProjectName) || 
          storyDate > latestProjectVersions.get(baseProjectName).date) {
        latestProjectVersions.set(baseProjectName, {
          projectName: story.projectName,
          date: storyDate
        });
      }
    });
    
    // Filter stories to only include those from the latest PRD version
    allStories.forEach(story => {
      const baseProjectName = story.projectName.replace(/\s+v?\d+(\.\d+)?\s*$/i, '').trim();
      const latestVersion = latestProjectVersions.get(baseProjectName);
      
      if (latestVersion && story.projectName === latestVersion.projectName) {
        filteredStories.push(story);
      }
    });
    
    console.log(`📊 Filtered to latest PRD versions: ${filteredStories.length} stories (from ${allStories.length} total)`);
    
    // Deduplicate stories based on title and project
    const seenStories = new Map();
    const deduplicatedStories = [];
    
    for (const story of filteredStories) {
      // Skip stories with null/empty titles
      if (!story.storyTitle || story.storyTitle.trim() === '') {
        continue;
      }
      
      // Create a key for deduplication
      const dedupeKey = `${story.projectName}:${story.storyTitle.toLowerCase().trim()}`;
      
      if (!seenStories.has(dedupeKey)) {
        seenStories.set(dedupeKey, true);
        deduplicatedStories.push(story);
      }
    }
    
    console.log(`📊 Deduplicated stories: ${deduplicatedStories.length} stories (from ${filteredStories.length} filtered)`);
    
    // Sort stories by project name, then by story title
    deduplicatedStories.sort((a, b) => {
      if (a.projectName !== b.projectName) {
        return a.projectName.localeCompare(b.projectName);
      }
      return a.storyTitle.localeCompare(b.storyTitle);
    });
    
    res.json({
      success: true,
      data: deduplicatedStories,
      count: deduplicatedStories.length,
      filters: {
        projectName: projectName || null,
        status: status || null
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching PRD stories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch PRD stories',
      details: error.message
    });
  }
}));

// GET /api/prd-stories/repositories - Get list of repositories
router.get('/repositories', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching repository list...');
    
    const { getAllCachedRepositories } = require('../notion');
    const repositories = await getAllCachedRepositories();
    
    // Filter out repos with undefined names and use repository field as name
    const validRepos = repositories
      .filter(repo => repo.repository && repo.repository.trim() !== '')
      .map(repo => ({
        name: repo.repository,
        url: repo.url || `https://github.com/${repo.repository}`,
        lastUpdated: repo.lastUpdated || new Date().toISOString(),
        hasPrd: repo.hasPrd || false,
        hasTaskList: repo.hasTaskList || false,
        status: repo.hasPrd ? (repo.hasTaskList ? 'prd-and-tasks' : 'prd-only') : (repo.hasTaskList ? 'tasks-only' : 'no-files')
      }));
    
    // Sort by name
    validRepos.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`📊 Found ${validRepos.length} repositories`);
    
    res.json({
      success: true,
      data: validRepos,
      count: validRepos.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching repositories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch repositories',
      details: error.message
    });
  }
}));

// POST /api/prd-stories/process-repo - Process a specific repository
router.post('/process-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`🔍 Scanning repository: ${repository}`);
    
    const PrdTaskProcessor = require('../prd-task-processor');
    const processor = new PrdTaskProcessor();
    
    const result = await processor.processRepository(repository);
    
    // Transform the result to match the expected format
    const repositoryData = {
      name: result.repository,
      status: result.hasPrd ? (result.hasTaskList ? 'prd-and-tasks' : 'prd-only') : (result.hasTaskList ? 'tasks-only' : 'no-files'),
      prdCount: result.hasPrd ? 1 : 0,
      taskCount: result.tasks ? result.tasks.length : 0,
      storyCount: result.stories ? result.stories.length : 0,
      progress: result.progress ? result.progress.progressPercentage : 0,
      lastUpdated: result.lastUpdated,
      stories: result.stories,
      tasks: result.tasks,
      progressDetails: result.progress
    };
    
    // Update progress cache
    const progressData = {
      repository: repositoryData.name,
      progress: result.progress,
      lastUpdated: result.lastUpdated
    };
    
    // Update cache for this specific repository
    progressCache.set(repository, {
      data: [progressData],
      timestamp: Date.now()
    });
    
    // Update cache for 'all' repositories
    const allCached = progressCache.get('all');
    if (allCached) {
      const existingIndex = allCached.data.findIndex(p => p.repository === repository);
      if (existingIndex >= 0) {
        allCached.data[existingIndex] = progressData;
      } else {
        allCached.data.push(progressData);
      }
      allCached.timestamp = Date.now();
    }
    
    console.log(`✅ Processed repository: ${repository} (${repositoryData.status})`);
    
    res.json({
      success: true,
      data: repositoryData
    });
    
  } catch (error) {
    console.error('❌ Error processing repository:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process repository',
      details: error.message
    });
  }
}));

// POST /api/prd-stories/ignore-repo - Ignore a repository
router.post('/ignore-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`🚫 Ignoring repository: ${repository}`);
    
    // Read current ignored repos
    const fs = require('fs');
    const path = require('path');
    const ignoredReposPath = path.join(__dirname, '..', 'data', 'ignored-repos.json');
    
    let ignoredRepos = [];
    if (fs.existsSync(ignoredReposPath)) {
      const data = fs.readFileSync(ignoredReposPath, 'utf8');
      ignoredRepos = JSON.parse(data);
    }
    
    // Add repository to ignored list if not already there
    if (!ignoredRepos.includes(repository)) {
      ignoredRepos.push(repository);
      fs.writeFileSync(ignoredReposPath, JSON.stringify(ignoredRepos, null, 2));
    }
    
    console.log(`✅ Repository ${repository} added to ignored list`);
    
    res.json({
      success: true,
      message: `Repository ${repository} has been ignored`,
      ignoredRepos: ignoredRepos
    });
    
  } catch (error) {
    console.error('❌ Error ignoring repository:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ignore repository',
      details: error.message
    });
  }
}));

// GET /api/prd-stories/ignored - Get list of ignored repositories
router.get('/ignored', asyncHandler(async (req, res) => {
  try {
    console.log('📊 Fetching ignored repositories...');
    
    const fs = require('fs');
    const path = require('path');
    const ignoredReposPath = path.join(__dirname, '..', 'data', 'ignored-repos.json');
    
    let ignoredRepos = [];
    if (fs.existsSync(ignoredReposPath)) {
      const data = fs.readFileSync(ignoredReposPath, 'utf8');
      ignoredRepos = JSON.parse(data);
    }
    
    console.log(`📊 Found ${ignoredRepos.length} ignored repositories`);
    
    res.json({
      success: true,
      data: ignoredRepos,
      count: ignoredRepos.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching ignored repositories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ignored repositories',
      details: error.message
    });
  }
}));

// POST /api/prd-stories/unignore-repo - Remove repository from ignored list
router.post('/unignore-repo', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository name is required'
      });
    }
    
    console.log(`✅ Unignoring repository: ${repository}`);
    
    const fs = require('fs');
    const path = require('path');
    const ignoredReposPath = path.join(__dirname, '..', 'data', 'ignored-repos.json');
    
    let ignoredRepos = [];
    if (fs.existsSync(ignoredReposPath)) {
      const data = fs.readFileSync(ignoredReposPath, 'utf8');
      ignoredRepos = JSON.parse(data);
    }
    
    // Remove repository from ignored list
    const index = ignoredRepos.indexOf(repository);
    if (index > -1) {
      ignoredRepos.splice(index, 1);
      fs.writeFileSync(ignoredReposPath, JSON.stringify(ignoredRepos, null, 2));
    }
    
    console.log(`✅ Repository ${repository} removed from ignored list`);
    
    res.json({
      success: true,
      message: `Repository ${repository} has been unignored`,
      ignoredRepos: ignoredRepos
    });
    
  } catch (error) {
    console.error('❌ Error unignoring repository:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unignore repository',
      details: error.message
    });
  }
}));

// POST /api/prd-stories - Create a new PRD story
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { projectName, storyTitle, storyDescription, priority, status } = req.body;
    
    if (!projectName || !storyTitle) {
      return res.status(400).json({
        success: false,
        error: 'Project name and story title are required'
      });
    }
    
    console.log(`📝 Creating PRD story: ${storyTitle} for project ${projectName}`);
    
    const { createPrdStory } = require('../notion');
    const story = await createPrdStory({
      projectName,
      storyTitle,
      storyDescription: storyDescription || '',
      priority: priority || 'Medium',
      status: status || 'Not Started'
    });
    
    console.log(`✅ Created PRD story: ${story.id}`);
    
    res.json({
      success: true,
      data: story
    });
    
  } catch (error) {
    console.error('❌ Error creating PRD story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create PRD story',
      details: error.message
    });
  }
}));

// PUT /api/prd-stories/:id - Update a PRD story
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Story ID is required'
      });
    }
    
    console.log(`📝 Updating PRD story: ${id}`);
    
    const { updatePrdStory } = require('../notion');
    const story = await updatePrdStory(id, updates);
    
    console.log(`✅ Updated PRD story: ${id}`);
    
    res.json({
      success: true,
      data: story
    });
    
  } catch (error) {
    console.error('❌ Error updating PRD story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update PRD story',
      details: error.message
    });
  }
}));

// POST /api/prd-stories/clear-cache - Clear PRD stories cache
router.post('/clear-cache', asyncHandler(async (req, res) => {
  try {
    console.log('🗑️ Clearing PRD stories cache...');
    
    // Clear any relevant caches here
    progressCache.clear();
    
    console.log('✅ PRD stories cache cleared');
    
    res.json({
      success: true,
      message: 'PRD stories cache cleared'
    });
    
  } catch (error) {
    console.error('❌ Error clearing PRD stories cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear PRD stories cache',
      details: error.message
    });
  }
}));

module.exports = router;
