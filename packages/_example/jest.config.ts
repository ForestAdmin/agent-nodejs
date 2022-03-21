/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverage: false,
  testMatch: ['<rootDir>/test/**/*.test.ts', '!<rootDir>/packages/_example/src/**/*.ts'],
};
