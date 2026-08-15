module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/src'],

  testRegex: '.*\\.spec\\.ts$',

  moduleFileExtensions: ['js', 'json', 'ts'],

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/dto/**',
  ],

  coverageDirectory: 'coverage',

  clearMocks: true,
};