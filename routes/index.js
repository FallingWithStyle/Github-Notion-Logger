const express = require('express');
const router = express.Router();

// Import route modules
const prdStoriesRoutes = require('./prd-stories');
const weeklyPlanningRoutes = require('./weekly-planning');
const projectProgressRoutes = require('./project-progress');
const commitsRoutes = require('./commits');
const timezoneRoutes = require('./timezone');
const colorPaletteRoutes = require('./color-palette');
const webhookRoutes = require('./webhook');
const staticRoutes = require('./static');
const apiV2Routes = require('./api-v2');
const apiRemainingRoutes = require('./api-remaining');

// Mount routes
router.use('/prd-stories', prdStoriesRoutes);
router.use('/', weeklyPlanningRoutes); // These routes don't have a prefix
router.use('/project-progress', projectProgressRoutes);
router.use('/commits', commitsRoutes);
router.use('/timezone-config', timezoneRoutes);
router.use('/color-palette', colorPaletteRoutes);
router.use('/v2', apiV2Routes);
router.use('/', apiRemainingRoutes);
router.use('/', webhookRoutes);
router.use('/', staticRoutes);

module.exports = router;
