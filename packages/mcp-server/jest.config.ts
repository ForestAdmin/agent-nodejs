/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.test.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // Map .js imports to .ts files for ESM compatibility
  // Also mock version.ts to avoid import.meta.url issues in Jest's CommonJS mode
  moduleNameMapper: {
    // Mock version.js before the general .js -> .ts mapping
    '\\.?/version\\.js$': '<rootDir>/src/__mocks__/version.ts',
    '\\.?/version$': '<rootDir>/src/__mocks__/version.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
