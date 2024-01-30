import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    '<rootDir>/packages/*/src/**/*.ts',
    '!<rootDir>/packages/_example/src/**/*.ts',
    '!<rootDir>/packages/datasource-customizer/src/decorators/search/generated-parser/*.ts',
  ],
  testMatch: ['<rootDir>/packages/*/test/**/*.test.ts'],
  setupFilesAfterEnv: ['jest-extended/all'],
};
export default config;
