import type { Config } from '@jest/types';

import path from 'path';

// Jest < 30 doesn't resolve wildcard exports in package.json.
// @anthropic-ai/sdk uses "./lib/*" exports that need this workaround.
const anthropicSdkDir = path.dirname(require.resolve('@anthropic-ai/sdk'));

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
  moduleNameMapper: {
    '^@anthropic-ai/sdk/(.*)$': `${anthropicSdkDir}/$1`,
  },
};
export default config;
