/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,

  // Allow generation of coverage for this specific package
  collectCoverageFrom: ['src/**/*.ts'],
};
