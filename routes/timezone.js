const express = require('express');
const router = express.Router();

// Helper function for async error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET /api/timezone-config - Get timezone configuration
router.get('/', (req, res) => {
  try {
    console.log('🌍 Fetching timezone configuration...');
    
    const timezoneConfig = require('../scripts/timezone-config');
    const config = timezoneConfig.getConfig();
    
    console.log(`🌍 Retrieved timezone configuration: ${config.timezone}`);
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('❌ Error fetching timezone configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timezone configuration',
      details: error.message
    });
  }
});

// POST /api/timezone-config - Update timezone configuration
router.post('/', (req, res) => {
  try {
    const { timezone, offset } = req.body;
    
    if (!timezone) {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required'
      });
    }
    
    console.log(`🌍 Updating timezone configuration to: ${timezone}`);
    
    const timezoneConfig = require('../scripts/timezone-config');
    const result = timezoneConfig.updateConfig({
      timezone: timezone,
      offset: offset || 0
    });
    
    console.log(`✅ Timezone configuration updated: ${result.timezone}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Timezone configuration updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating timezone configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timezone configuration',
      details: error.message
    });
  }
});

module.exports = router;
