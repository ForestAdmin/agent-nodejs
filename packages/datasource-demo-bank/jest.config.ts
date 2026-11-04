/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '!<rootDir>/src/components/**'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
};
