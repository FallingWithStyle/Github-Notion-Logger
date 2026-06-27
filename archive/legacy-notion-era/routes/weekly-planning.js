const express = require('express');
const router = express.Router();

// Helper function for async error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// POST /api/weekly-plan - Create or update weekly plan
router.post('/weekly-plan', asyncHandler(async (req, res) => {
  try {
    const { 
      weekStartDate, 
      projects, 
      focusAreas, 
      goals, 
      notes,
      timezone 
    } = req.body;
    
    if (!weekStartDate) {
      return res.status(400).json({
        success: false,
        error: 'Week start date is required'
      });
    }
    
    console.log(`📝 Creating/updating weekly plan for week starting ${weekStartDate}`);
    
    const { addOrUpdateWeeklyPlanningEntry } = require('../notion');
    const result = await addOrUpdateWeeklyPlanningEntry({
      weekStartDate,
      projects: projects || [],
      focusAreas: focusAreas || [],
      goals: goals || [],
      notes: notes || '',
      timezone: timezone || 'UTC'
    });
    
    console.log(`✅ Weekly plan ${result.isUpdate ? 'updated' : 'created'}: ${result.id}`);
    
    res.json({
      success: true,
      data: result,
      isUpdate: result.isUpdate
    });
    
  } catch (error) {
    console.error('❌ Error creating/updating weekly plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update weekly plan',
      details: error.message
    });
  }
}));

// GET /api/weekly-plans - Get all weekly plans
router.get('/weekly-plans', asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    console.log(`📅 Fetching weekly plans (limit: ${limit}, offset: ${offset})...`);
    
    const { getWeeklyPlanningData } = require('../notion');
    const allPlans = await getWeeklyPlanningData();
    
    // Sort by week start date (newest first)
    allPlans.sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate));
    
    // Apply pagination
    const paginatedPlans = allPlans.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    console.log(`📅 Retrieved ${paginatedPlans.length} weekly plans (${allPlans.length} total)`);
    
    res.json({
      success: true,
      data: paginatedPlans,
      count: paginatedPlans.length,
      total: allPlans.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < allPlans.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly plans',
      details: error.message
    });
  }
}));

// POST /api/weekly-plan/sync-notion - Sync weekly plan to Notion
router.post('/weekly-plan/sync-notion', asyncHandler(async (req, res) => {
  try {
    const { weekStartDate, projects, focusAreas, goals, notes, timezone } = req.body;
    
    if (!weekStartDate) {
      return res.status(400).json({
        success: false,
        error: 'Week start date is required'
      });
    }
    
    console.log(`🔄 Syncing weekly plan to Notion for week starting ${weekStartDate}`);
    
    const { addOrUpdateWeeklyPlanningEntry } = require('../notion');
    const result = await addOrUpdateWeeklyPlanningEntry({
      weekStartDate,
      projects: projects || [],
      focusAreas: focusAreas || [],
      goals: goals || [],
      notes: notes || '',
      timezone: timezone || 'UTC'
    });
    
    console.log(`✅ Weekly plan synced to Notion: ${result.id}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Weekly plan synced to Notion successfully'
    });
    
  } catch (error) {
    console.error('❌ Error syncing weekly plan to Notion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync weekly plan to Notion',
      details: error.message
    });
  }
}));

// GET /api/weekly-plan/notion - Get weekly plan from Notion
router.get('/weekly-plan/notion', asyncHandler(async (req, res) => {
  try {
    const { weekStartDate } = req.query;
    
    console.log(`📅 Fetching weekly plan from Notion${weekStartDate ? ` for week starting ${weekStartDate}` : ''}...`);
    
    const { getWeeklyPlanningData } = require('../notion');
    const data = await getWeeklyPlanningData(weekStartDate);
    
    console.log(`📅 Retrieved ${data.length} weekly planning entries from Notion`);
    
    res.json({
      success: true,
      data: data,
      count: data.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching weekly plan from Notion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly plan from Notion',
      details: error.message
    });
  }
}));

module.exports = router;
