/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/examples/**'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
