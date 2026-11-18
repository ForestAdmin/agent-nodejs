/* eslint-disable import/no-relative-packages */
import path from 'path';

import jestConfig from '../../jest.config';

// Jest < 30 doesn't resolve wildcard exports in package.json, and @anthropic-ai/sdk, which
// @forestadmin/ai-proxy loads, uses "./lib/*" exports.
const anthropicSdkDir = path.dirname(require.resolve('@anthropic-ai/sdk'));

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  // Under --experimental-vm-modules Jest refuses to require a "type": "module" package, and
  // sanitize-html's htmlparser2 12 ships no CommonJS entry, so @forestadmin/agent-bff would not load.
  moduleNameMapper: {
    '^sanitize-html$': '<rootDir>/test/__helper__/sanitize-html-stub.ts',
    '^@anthropic-ai/sdk/(.*)$': `${anthropicSdkDir}/$1`,
  },
};
