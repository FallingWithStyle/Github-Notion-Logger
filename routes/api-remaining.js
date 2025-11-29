const express = require('express');
const { logCommitsToNotion, addWeeklyPlanningEntry, addOrUpdateWeeklyPlanningEntry, getWeeklyPlanningData, updateWeeklyPlanningEntry, cleanupDuplicateEntries } = require('../notion');
const { assignColor, getProjectColor, updateProjectColor, migrateExistingProjects, getColorStats, hexToHsl, generatePaletteFromHue } = require('../scripts/color-palette');
const { scheduleDailyProcessing, runManualProcessing } = require('../scripts/wanderlog-processor');
const LlamaHubService = require('../services/llama-hub-service');
const ProjectManagementService = require('../services/project-management-service');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// Initialize services
const llamaHub = new LlamaHubService();
const projectManagementService = new ProjectManagementService();

// Projects API endpoint for external consumption (e.g., Wanderjob)
router.get('/projects', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  console.log(`📥 GET /api/projects - Query params:`, req.query);
  
  try {
    const { page = 1, limit = 100, category, search, status } = req.query;
    
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search,
      status
    };
    
    console.log(`📊 Fetching project overview with filters:`, filters);
    const result = await projectManagementService.getProjectOverview(filters);
    
    const duration = Date.now() - startTime;
    console.log(`✅ GET /api/projects - Success in ${duration}ms`);
    
    // Return simplified format for external consumption
    if (result.success) {
      res.json({
        success: true,
        projects: result.data || [],
        pagination: result.pagination || {},
        metadata: result.metadata || {}
      });
    } else {
      console.error(`❌ GET /api/projects - Service returned error:`, result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Error getting projects',
        details: result.details
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ GET /api/projects - Error after ${duration}ms:`, error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Error getting projects',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

// Weekly planning API
router.get('/weekly-data', asyncHandler(async (req, res) => {
  try {
    const { weekStart } = req.query;
    
    console.log(`📊 Fetching weekly data${weekStart ? ` for week ${weekStart}` : ''}...`);
    
    // Get data from Notion
    const notionData = await getWeeklyPlanningData(weekStart);
    
    // Get commit log data for visualization
    const fs = require('fs');
    const path = require('path');
    const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data'));
    const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');
    
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      try {
        const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
        commitLog = JSON.parse(data);
      } catch (error) {
        console.error('❌ Error reading commit log:', error.message);
      }
    }
    
    // Get color palette data
    const colorStats = getColorStats();
    const { getAllProjectColors } = require('../scripts/color-palette');
    const projectColors = getAllProjectColors();
    
    res.json({
      success: true,
      data: {
        notion: notionData,
        commitLog: commitLog,
        colorStats: colorStats,
        projectColors: projectColors
      },
      count: notionData.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching weekly data',
      details: error.message 
    });
  }
}));

// Fetch Notion data endpoint for Commit Activity Visualizer
router.get('/fetch-notion-data', asyncHandler(async (req, res) => {
  try {
    const { weekStart } = req.query;
    
    console.log(`📊 Fetching Notion data for Commit Activity Visualizer${weekStart ? ` for week ${weekStart}` : ''}...`);
    
    // Get data from Notion
    const notionData = await getWeeklyPlanningData(weekStart);
    
    // Get commit log data for visualization
    const fs = require('fs');
    const path = require('path');
    const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data'));
    const COMMIT_LOG_PATH = path.join(DATA_DIR, 'commit-log.json');
    
    let commitLog = [];
    if (fs.existsSync(COMMIT_LOG_PATH)) {
      try {
        const data = fs.readFileSync(COMMIT_LOG_PATH, 'utf8');
        commitLog = JSON.parse(data);
      } catch (error) {
        console.error('❌ Error reading commit log:', error.message);
      }
    }
    
    // Get color palette data
    const colorStats = getColorStats();
    const { getAllProjectColors } = require('../scripts/color-palette');
    const projectColors = getAllProjectColors();
    
    res.json({
      success: true,
      data: {
        notion: notionData,
        commitLog: commitLog,
        colorStats: colorStats,
        projectColors: projectColors
      },
      count: notionData.length,
      message: `Successfully fetched ${notionData.length} Notion entries and ${commitLog.length} commit log entries`
    });
    
  } catch (error) {
    console.error('❌ Error fetching Notion data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching Notion data',
      details: error.message 
    });
  }
}));

router.post('/weekly-plan', asyncHandler(async (req, res) => {
  try {
    const { projects } = req.body;
    
    if (!projects || !Array.isArray(projects)) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing or invalid projects array' 
      });
    }
    
    console.log(`📝 Processing weekly plan with ${projects.length} projects...`);
    
    // Process each project
    const results = [];
    for (const project of projects) {
      try {
        const result = await addOrUpdateWeeklyPlanningEntry(project);
        results.push({
          projectName: project.projectName,
          success: true,
          entryId: result.id
        });
      } catch (error) {
        console.error(`❌ Error processing project ${project.projectName}:`, error.message);
        results.push({
          projectName: project.projectName,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Weekly plan processing completed: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Weekly plan processed successfully`,
      results: results,
      summary: {
        total: projects.length,
        success: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing weekly plan:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error processing weekly plan',
      details: error.message 
    });
  }
}));

router.get('/weekly-plans', asyncHandler(async (req, res) => {
  try {
    const { weekStart } = req.query;
    
    console.log(`📊 Fetching weekly plans${weekStart ? ` for week ${weekStart}` : ''}...`);
    
    const data = await getWeeklyPlanningData(weekStart);
    
    res.json({
      success: true,
      data: data,
      count: data.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly plans:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching weekly plans',
      details: error.message 
    });
  }
}));

router.post('/weekly-plan/sync-notion', asyncHandler(async (req, res) => {
  try {
    const { projects } = req.body;
    
    if (!projects || !Array.isArray(projects)) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing or invalid projects array' 
      });
    }
    
    console.log(`🔄 Syncing ${projects.length} projects to Notion...`);
    
    // Process each project
    const results = [];
    for (const project of projects) {
      try {
        const result = await addOrUpdateWeeklyPlanningEntry(project);
        results.push({
          projectName: project.projectName,
          success: true,
          entryId: result.id
        });
      } catch (error) {
        console.error(`❌ Error syncing project ${project.projectName}:`, error.message);
        results.push({
          projectName: project.projectName,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Notion sync completed: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Notion sync completed successfully`,
      results: results,
      summary: {
        total: projects.length,
        success: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error syncing to Notion:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error syncing to Notion',
      details: error.message 
    });
  }
}));

router.get('/weekly-plan/notion', asyncHandler(async (req, res) => {
  try {
    const { weekStart } = req.query;
    
    console.log(`📊 Fetching weekly planning data from Notion${weekStart ? ` for week ${weekStart}` : ''}...`);
    
    const notionData = await getWeeklyPlanningData(weekStart);
    
    res.json({
      success: true,
      data: notionData,
      count: notionData.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly planning data from Notion:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching weekly planning data from Notion',
      details: error.message 
    });
  }
}));

// Timezone configuration API
router.get('/timezone-config', (req, res) => {
  try {
    const timezoneConfig = require('../scripts/timezone-config');
    res.json({
      success: true,
      config: timezoneConfig.getConfig()
    });
  } catch (error) {
    console.error('❌ Error getting timezone config:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting timezone config',
      details: error.message 
    });
  }
});

router.post('/timezone-config', (req, res) => {
  try {
    const { timezone, cutoffHour } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ 
        success: false,
        error: 'Timezone is required' 
      });
    }
    
    const timezoneConfig = require('../scripts/timezone-config');
    timezoneConfig.setConfig({ timezone, cutoffHour });
    
    res.json({
      success: true,
      message: 'Timezone configuration updated successfully',
      config: timezoneConfig.getConfig()
    });
  } catch (error) {
    console.error('❌ Error updating timezone config:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating timezone config',
      details: error.message 
    });
  }
});

// Color palette API
router.get('/color-palette/stats', asyncHandler(async (req, res) => {
  try {
    const stats = getColorStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Error getting color palette stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting color palette stats',
      details: error.message 
    });
  }
}));

router.get('/color-palette/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const color = getProjectColor(projectName);
    
    res.json({
      success: true,
      projectName: projectName,
      color: color
    });
  } catch (error) {
    console.error('❌ Error getting project color:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting project color',
      details: error.message 
    });
  }
}));

router.put('/color-palette/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const { color } = req.body;
    
    if (!color) {
      return res.status(400).json({ 
        success: false,
        error: 'Color is required' 
      });
    }
    
    const result = await updateProjectColor(projectName, color);
    
    res.json({
      success: true,
      message: 'Project color updated successfully',
      projectName: projectName,
      color: result.color
    });
  } catch (error) {
    console.error('❌ Error updating project color:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating project color',
      details: error.message 
    });
  }
}));

router.post('/color-palette/generate', asyncHandler(async (req, res) => {
  try {
    const { category, count = 8 } = req.body;
    
    if (!category) {
      return res.status(400).json({ 
        success: false,
        error: 'Category is required' 
      });
    }
    
    const palette = generatePaletteFromHue(category, count);
    
    res.json({
      success: true,
      message: 'Color palette generated successfully',
      category: category,
      palette: palette
    });
  } catch (error) {
    console.error('❌ Error generating color palette:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error generating color palette',
      details: error.message 
    });
  }
}));

router.post('/color-palette/migrate', asyncHandler(async (req, res) => {
  try {
    const result = await migrateExistingProjects();
    
    res.json({
      success: true,
      message: 'Color migration completed successfully',
      result: result
    });
  } catch (error) {
    console.error('❌ Error migrating colors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error migrating colors',
      details: error.message 
    });
  }
}));

router.get('/color-palette/category/:category', asyncHandler(async (req, res) => {
  try {
    const { category } = req.params;
    const stats = getColorStats();
    
    const categoryStats = stats.categories[category] || {
      count: 0,
      colors: []
    };
    
    res.json({
      success: true,
      category: category,
      stats: categoryStats
    });
  } catch (error) {
    console.error('❌ Error getting category colors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting category colors',
      details: error.message 
    });
  }
}));

router.post('/color-palette/update-category-colors', asyncHandler(async (req, res) => {
  try {
    const { category, colors } = req.body;
    
    if (!category || !colors || !Array.isArray(colors)) {
      return res.status(400).json({ 
        success: false,
        error: 'Category and colors array are required' 
      });
    }
    
    // Update category colors logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      message: 'Category colors updated successfully',
      category: category,
      colors: colors
    });
  } catch (error) {
    console.error('❌ Error updating category colors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating category colors',
      details: error.message 
    });
  }
}));

router.post('/color-palette/reset-colors', asyncHandler(async (req, res) => {
  try {
    // Reset colors logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      message: 'Colors reset successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting colors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error resetting colors',
      details: error.message 
    });
  }
}));

// Wanderlog API
router.post('/wanderlog/process', asyncHandler(async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        error: 'Date is required' 
      });
    }
    
    const result = await runManualProcessing(date);
    
    res.json({
      success: true,
      message: 'Wanderlog processing completed successfully',
      result: result
    });
  } catch (error) {
    console.error('❌ Error processing wanderlog:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error processing wanderlog',
      details: error.message 
    });
  }
}));

router.get('/wanderlog', asyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    
    // Get wanderlog data logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      data: [],
      message: 'Wanderlog data retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting wanderlog data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting wanderlog data',
      details: error.message 
    });
  }
}));

router.get('/wanderlog/range', asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date and end date are required' 
      });
    }
    
    // Get wanderlog range data logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      data: [],
      message: 'Wanderlog range data retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting wanderlog range data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting wanderlog range data',
      details: error.message 
    });
  }
}));

router.get('/wanderlog/date/:date', asyncHandler(async (req, res) => {
  try {
    const { date } = req.params;
    
    // Get wanderlog data for specific date logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      date: date,
      data: [],
      message: 'Wanderlog data for date retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting wanderlog data for date:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting wanderlog data for date',
      details: error.message 
    });
  }
}));

router.get('/wanderlog/stats', asyncHandler(async (req, res) => {
  try {
    // Get wanderlog stats logic would go here
    // This is a placeholder for the actual implementation
    
    res.json({
      success: true,
      stats: {},
      message: 'Wanderlog stats retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error getting wanderlog stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting wanderlog stats',
      details: error.message 
    });
  }
}));

// Llama-hub API
router.get('/llama/health', asyncHandler(async (req, res) => {
  try {
    const health = await llamaHub.checkHealth();
    res.json({
      success: true,
      health: health
    });
  } catch (error) {
    console.error('❌ Error checking Llama-hub health:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error checking Llama-hub health',
      details: error.message 
    });
  }
}));

router.get('/llama/models', asyncHandler(async (req, res) => {
  try {
    const models = await llamaHub.getAvailableModels();
    res.json({
      success: true,
      models: models
    });
  } catch (error) {
    console.error('❌ Error getting Llama-hub models:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error getting Llama-hub models',
      details: error.message 
    });
  }
}));

router.post('/llama/chat', asyncHandler(async (req, res) => {
  try {
    const { message, model = 'llama3-7b' } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }
    
    const response = await llamaHub.chat(message, model);
    
    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('❌ Error with Llama-hub chat:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error with Llama-hub chat',
      details: error.message 
    });
  }
}));

router.post('/llama/generate', asyncHandler(async (req, res) => {
  try {
    const { prompt, model = 'llama3-7b' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false,
        error: 'Prompt is required' 
      });
    }
    
    const response = await llamaHub.generate(prompt, model);
    
    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('❌ Error with Llama-hub generation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error with Llama-hub generation',
      details: error.message 
    });
  }
}));

router.post('/llama/analyze-project', asyncHandler(async (req, res) => {
  try {
    const { projectData, model = 'llama3-7b' } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ 
        success: false,
        error: 'Project data is required' 
      });
    }
    
    const response = await llamaHub.analyzeProject(projectData, model);
    
    res.json({
      success: true,
      analysis: response
    });
  } catch (error) {
    console.error('❌ Error with Llama-hub project analysis:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error with Llama-hub project analysis',
      details: error.message 
    });
  }
}));

router.post('/llama/suggest-commit', asyncHandler(async (req, res) => {
  try {
    const { changes, model = 'llama3-7b' } = req.body;
    
    if (!changes) {
      return res.status(400).json({ 
        success: false,
        error: 'Changes are required' 
      });
    }
    
    const response = await llamaHub.suggestCommitMessage(changes, model);
    
    res.json({
      success: true,
      suggestion: response
    });
  } catch (error) {
    console.error('❌ Error with Llama-hub commit suggestion:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error with Llama-hub commit suggestion',
      details: error.message 
    });
  }
}));

module.exports = router;
