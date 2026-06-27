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

// GET /api/project-progress - Get project progress data
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { repository, includeStories = 'true' } = req.query;
    
    console.log(`📊 Fetching project progress${repository ? ` for ${repository}` : ''}...`);
    
    // Check cache first
    const cacheKey = `progress:${repository || 'all'}:${includeStories}`;
    const cached = progressCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log(`📊 Returning cached progress data for ${repository || 'all'}`);
      return res.json({
        success: true,
        data: cached.data,
        count: cached.data.length,
        cached: true,
        timestamp: cached.timestamp
      });
    }
    
    const { getProjectProgressData } = require('../notion');
    const data = await getProjectProgressData(repository, includeStories === 'true');
    
    // Update cache
    progressCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    console.log(`📊 Retrieved ${data.length} project progress entries`);
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      cached: false,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error fetching project progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project progress',
      details: error.message
    });
  }
}));

// GET /api/project-progress/:repository - Get progress for specific repository
router.get('/:repository', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.params;
    const { includeStories = 'true' } = req.query;
    
    console.log(`📊 Fetching progress for repository: ${repository}`);
    
    // Check cache first
    const cacheKey = `progress:${repository}:${includeStories}`;
    const cached = progressCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log(`📊 Returning cached progress data for ${repository}`);
      return res.json({
        success: true,
        data: cached.data,
        count: cached.data.length,
        cached: true,
        timestamp: cached.timestamp
      });
    }
    
    const { getProjectProgressData } = require('../notion');
    const data = await getProjectProgressData(repository, includeStories === 'true');
    
    // Update cache
    progressCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    console.log(`📊 Retrieved ${data.length} progress entries for ${repository}`);
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      repository: repository,
      cached: false,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error fetching progress for repository:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress for repository',
      details: error.message
    });
  }
}));

// POST /api/project-progress/clear-cache - Clear progress cache
router.post('/clear-cache', asyncHandler(async (req, res) => {
  try {
    const { repository } = req.body;
    
    console.log(`🗑️ Clearing progress cache${repository ? ` for ${repository}` : ''}...`);
    
    if (repository) {
      // Clear specific repository cache
      const keysToDelete = [];
      for (const [key, value] of progressCache.entries()) {
        if (key.includes(`:${repository}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => progressCache.delete(key));
    } else {
      // Clear all progress cache
      progressCache.clear();
    }
    
    console.log(`✅ Progress cache cleared${repository ? ` for ${repository}` : ''}`);
    
    res.json({
      success: true,
      message: `Progress cache cleared${repository ? ` for ${repository}` : ''}`,
      repository: repository || null
    });
    
  } catch (error) {
    console.error('❌ Error clearing progress cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear progress cache',
      details: error.message
    });
  }
}));

module.exports = router;
