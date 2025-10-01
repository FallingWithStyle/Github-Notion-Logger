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
  verbose: true
};
