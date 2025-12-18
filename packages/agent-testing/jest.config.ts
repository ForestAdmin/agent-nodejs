/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  testMatch: ['<rootDir>/example/test/**/*.test.ts', '<rootDir>/test/**/*.test.ts'],
};
