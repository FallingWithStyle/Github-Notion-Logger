const express = require('express');
const { getAllProjectColors } = require('../scripts/color-palette');
const { asyncHandler } = require('../services/server');

const router = express.Router();

// Frozen heatmap: project colors without Notion (replaces legacy /api/weekly-data)
router.get('/weekly-data', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    projectColors: getAllProjectColors()
  });
}));

module.exports = router;
