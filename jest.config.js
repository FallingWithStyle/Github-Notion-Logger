module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test-*.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/test-*.js',
    '!jest.config.js',
    '!coverage/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  testTimeout: 30000,
  verbose: true,
  // Fix worker exceptions
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // Improve test isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Better error reporting
  errorOnDeprecated: true,
  // Performance improvements
  cache: false,
  // Better async handling
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};
