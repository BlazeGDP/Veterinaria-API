const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,

  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};