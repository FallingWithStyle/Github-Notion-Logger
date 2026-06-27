const commitProcessingService = require('./commit-processing-service');

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  asyncHandler,
  ...commitProcessingService
};
