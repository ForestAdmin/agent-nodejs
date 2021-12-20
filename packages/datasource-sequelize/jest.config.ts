export default {
  // eslint-disable-next-line global-require
  ...require('../../jest.config'),

  // Allow generation of coverage for this specific package
  collectCoverageFrom: ['src/**/*.ts'],
};
