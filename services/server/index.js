const commitProcessingService = require('./commit-processing-service');
const colorManagementService = require('./color-management-service');
const projectProcessingService = require('./project-processing-service');
const backfillService = require('./backfill-service');
const userMigrationService = require('./user-migration-service');

module.exports = {
  ...commitProcessingService,
  ...colorManagementService,
  ...projectProcessingService,
  ...backfillService,
  ...userMigrationService
};
