import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['packages/**/src/**/*.ts', '!packages/**/dist/**/*'],
  testPathIgnorePatterns: ['/dist/test/'],
  setupFilesAfterEnv: ['jest-extended/all'],
};
export default config;
