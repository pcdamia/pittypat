module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@engine/(.*)$': '<rootDir>/src/engine/$1',
  },
  collectCoverageFrom: ['src/engine/**/*.ts', '!src/engine/__tests__/**'],
  coverageDirectory: 'coverage',
};
