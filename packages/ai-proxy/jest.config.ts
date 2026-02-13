/* eslint-disable import/no-relative-packages */
import path from 'path';

import jestConfig from '../../jest.config';

// Jest < 30 doesn't resolve wildcard exports in package.json.
// @anthropic-ai/sdk uses "./lib/*" exports that need this workaround.
const anthropicSdkDir = path.dirname(require.resolve('@anthropic-ai/sdk'));

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/examples/**'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  moduleNameMapper: {
    '^@anthropic-ai/sdk/(.*)$': `${anthropicSdkDir}/$1`,
  },
};
