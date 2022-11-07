import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    '<rootDir>/packages/*/src/**/*.ts',
    '!<rootDir>/packages/_example/src/**/*.ts',
  ],
  testMatch: ['<rootDir>/packages/*/test/**/*.test.ts'],
  setupFilesAfterEnv: ['jest-extended/all'],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
};
export default config;
