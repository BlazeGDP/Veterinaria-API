const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,

  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};