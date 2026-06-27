const express = require('express');
const router = express.Router();

// Helper function for async error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET /api/color-palette/stats - Get color palette statistics
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    console.log('🎨 Fetching color palette statistics...');
    
    const { getColorStats } = require('../scripts/color-palette');
    const stats = await getColorStats();
    
    console.log(`🎨 Retrieved color palette statistics: ${stats.totalProjects} projects`);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching color palette statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch color palette statistics',
      details: error.message
    });
  }
}));

// GET /api/color-palette/project/:projectName - Get color for specific project
router.get('/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    
    console.log(`🎨 Fetching color for project: ${projectName}`);
    
    const { getProjectColor } = require('../scripts/color-palette');
    const color = await getProjectColor(projectName);
    
    console.log(`🎨 Retrieved color for ${projectName}: ${color}`);
    
    res.json({
      success: true,
      data: {
        projectName: projectName,
        color: color
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching project color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project color',
      details: error.message
    });
  }
}));

// PUT /api/color-palette/project/:projectName - Update color for specific project
router.put('/project/:projectName', asyncHandler(async (req, res) => {
  try {
    const { projectName } = req.params;
    const { color } = req.body;
    
    if (!color) {
      return res.status(400).json({
        success: false,
        error: 'Color is required'
      });
    }
    
    console.log(`🎨 Updating color for project: ${projectName} to ${color}`);
    
    const { updateProjectColor } = require('../scripts/color-palette');
    const result = await updateProjectColor(projectName, color);
    
    console.log(`✅ Updated color for ${projectName}: ${result.color}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error updating project color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project color',
      details: error.message
    });
  }
}));

// POST /api/color-palette/generate - Generate new color palette
router.post('/generate', asyncHandler(async (req, res) => {
  try {
    const { category, hue } = req.body;
    
    console.log(`🎨 Generating color palette${category ? ` for category: ${category}` : ''}${hue ? ` with hue: ${hue}` : ''}...`);
    
    const { generatePaletteFromHue } = require('../scripts/color-palette');
    const palette = await generatePaletteFromHue(category, hue);
    
    console.log(`✅ Generated color palette with ${palette.length} colors`);
    
    res.json({
      success: true,
      data: {
        category: category,
        hue: hue,
        palette: palette
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating color palette:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate color palette',
      details: error.message
    });
  }
}));

// POST /api/color-palette/migrate - Migrate existing projects to new color system
router.post('/migrate', asyncHandler(async (req, res) => {
  try {
    console.log('🎨 Migrating existing projects to new color system...');
    
    const { migrateExistingProjects } = require('../scripts/color-palette');
    const result = await migrateExistingProjects();
    
    console.log(`✅ Migrated ${result.migrated} projects, ${result.skipped} skipped`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error migrating projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to migrate projects',
      details: error.message
    });
  }
}));

// GET /api/color-palette/category/:category - Get colors for specific category
router.get('/category/:category', asyncHandler(async (req, res) => {
  try {
    const { category } = req.params;
    
    console.log(`🎨 Fetching colors for category: ${category}`);
    
    const { getCategoryColors } = require('../scripts/color-palette');
    const colors = await getCategoryColors(category);
    
    console.log(`🎨 Retrieved ${colors.length} colors for category: ${category}`);
    
    res.json({
      success: true,
      data: {
        category: category,
        colors: colors
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching category colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category colors',
      details: error.message
    });
  }
}));

// POST /api/color-palette/update-category-colors - Update colors for category
router.post('/update-category-colors', asyncHandler(async (req, res) => {
  try {
    const { category, colors } = req.body;
    
    if (!category || !colors) {
      return res.status(400).json({
        success: false,
        error: 'Category and colors are required'
      });
    }
    
    console.log(`🎨 Updating colors for category: ${category}`);
    
    const { updateCategoryColors } = require('../scripts/color-palette');
    const result = await updateCategoryColors(category, colors);
    
    console.log(`✅ Updated colors for category: ${category}`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error updating category colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category colors',
      details: error.message
    });
  }
}));

// POST /api/color-palette/reset-colors - Reset all colors
router.post('/reset-colors', asyncHandler(async (req, res) => {
  try {
    console.log('🎨 Resetting all colors...');
    
    const { resetAllColors } = require('../scripts/color-palette');
    const result = await resetAllColors();
    
    console.log(`✅ Reset ${result.reset} colors`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error resetting colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset colors',
      details: error.message
    });
  }
}));

module.exports = router;
