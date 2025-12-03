/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.test.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // Map .js imports to .ts files for ESM compatibility
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
