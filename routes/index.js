const express = require('express');
const webhookRoutes = require('./webhook');
const timezoneRoutes = require('./timezone');
const colorPaletteRoutes = require('./color-palette');
const heatmapApiRoutes = require('./heatmap-api');

const router = express.Router();

router.use('/', heatmapApiRoutes);
router.use('/timezone-config', timezoneRoutes);
router.use('/color-palette', colorPaletteRoutes);
router.use('/', webhookRoutes);

module.exports = router;
