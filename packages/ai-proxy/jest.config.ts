/* eslint-disable import/no-relative-packages */
import path from 'path';

import jestConfig from '../../jest.config';

// Override the root moduleNameMapper to resolve @anthropic-ai/sdk from THIS package,
// not the root. ai-proxy depends on a newer version that has lib/transform-json-schema.
const anthropicSdkDir = path.dirname(require.resolve('@anthropic-ai/sdk'));

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/examples/**'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    '^@anthropic-ai/sdk/(.*)$': `${anthropicSdkDir}/$1`,
  },
};
