const commitProcessingService = require('./commit-processing-service');
const colorManagementService = require('./color-management-service');
const projectProcessingService = require('./project-processing-service');
const backfillService = require('./backfill-service');
const userMigrationService = require('./user-migration-service');

// Async handler utility for Express routes
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  asyncHandler,
  ...commitProcessingService,
  ...colorManagementService,
  ...projectProcessingService,
  ...backfillService,
  ...userMigrationService
};
