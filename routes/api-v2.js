const express = require('express');
const ProjectManagementService = require('../services/project-management-service');
const ProgressTrackingService = require('../services/progress-tracking-service');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// Initialize services
const projectManagementService = new ProjectManagementService();
const progressTrackingService = new ProgressTrackingService();

// Projects API v2
router.get('/projects/overview', asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, status } = req.query;
    
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search,
      status
    };
    
    const result = await projectManagementService.getProjectOverview(filters);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting project overview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting project overview',
      details: error.message 
    });
  }
}));

router.get('/projects/:projectName/health', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const result = await projectManagementService.getProjectHealth(projectName);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting project health:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting project health',
      details: error.message 
    });
  }
}));

router.get('/projects/categories', asyncHandler(async (req, res) => {
  try {
    const result = await projectManagementService.getProjectCategories();
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting project categories:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting project categories',
      details: error.message 
    });
  }
}));

router.get('/projects/search', asyncHandler(async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query is required' 
      });
    }
    
    const result = await projectManagementService.searchProjects(q, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json(result);
  } catch (error) {
    console.error('❌ Error searching projects:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error searching projects',
      details: error.message 
    });
  }
}));

// Progress API v2
router.get('/progress/analytics', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.query;
    const result = await progressTrackingService.getProgressAnalytics(projectName);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting progress analytics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting progress analytics',
      details: error.message 
    });
  }
}));

router.get('/progress/incomplete', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.query;
    const result = await progressTrackingService.getIncompleteWork(projectName);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting incomplete work:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting incomplete work',
      details: error.message 
    });
  }
}));

router.get('/progress/velocity', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.query;
    const result = await progressTrackingService.getVelocityTrends(projectName);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting velocity trends:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting velocity trends',
      details: error.message 
    });
  }
}));

router.get('/progress/blocked', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.query;
    const result = await progressTrackingService.getBlockedAndStaleItems(projectName);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting blocked items:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting blocked items',
      details: error.message 
    });
  }
}));

// Cache management
router.post('/cache/projects/clear', asyncHandler(async (req, res) => {
  try {
    await projectManagementService.clearCache();
    res.json({ 
      success: true,
      message: 'Project cache cleared successfully' 
    });
  } catch (error) {
    console.error('❌ Error clearing project cache:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error clearing project cache',
      details: error.message 
    });
  }
}));

router.post('/cache/progress/clear', asyncHandler(async (req, res) => {
  try {
    await progressTrackingService.clearCache();
    res.json({ 
      success: true,
      message: 'Progress cache cleared successfully' 
    });
  } catch (error) {
    console.error('❌ Error clearing progress cache:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error clearing progress cache',
      details: error.message 
    });
  }
}));

router.get('/cache/status', asyncHandler(async (req, res) => {
  try {
    const projectCache = projectManagementService.getCacheStatus();
    const progressCache = progressTrackingService.getCacheStatus();
    
    res.json({
      success: true,
      caches: {
        projects: projectCache,
        progress: progressCache
      }
    });
  } catch (error) {
    console.error('❌ Error getting cache status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting cache status',
      details: error.message 
    });
  }
}));

// Performance monitoring
router.get('/performance/stats', asyncHandler(async (req, res) => {
  try {
    const projectStats = projectManagementService.getPerformanceStats();
    const progressStats = progressTrackingService.getPerformanceStats();
    
    res.json({
      success: true,
      performance: {
        projects: projectStats,
        progress: progressStats
      }
    });
  } catch (error) {
    console.error('❌ Error getting performance stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting performance stats',
      details: error.message 
    });
  }
}));

router.post('/performance/clear', asyncHandler(async (req, res) => {
  try {
    await projectManagementService.clearPerformanceData();
    await progressTrackingService.clearPerformanceData();
    
    res.json({ 
      success: true,
      message: 'Performance data cleared successfully' 
    });
  } catch (error) {
    console.error('❌ Error clearing performance data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error clearing performance data',
      details: error.message 
    });
  }
}));

module.exports = router;
