/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  testMatch: ['<rootDir>/test/**/*.test.ts'],
};
