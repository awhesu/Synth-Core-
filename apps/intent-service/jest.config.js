module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@syntherium/db$': '<rootDir>/../../libs/db/src/index.ts',
    '^@syntherium/idempotency$': '<rootDir>/../../libs/idempotency/src/index.ts',
    '^@syntherium/observability$': '<rootDir>/../../libs/observability/src/index.ts',
    '^@syntherium/security$': '<rootDir>/../../libs/security/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
};
