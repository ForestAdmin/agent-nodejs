/* eslint-disable import/no-relative-packages */
import jestConfig from '../../jest.config';

export default {
  ...jestConfig,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  // Under --experimental-vm-modules Jest refuses to require a "type": "module" package, and
  // sanitize-html's htmlparser2 12 ships no CommonJS entry, so @forestadmin/agent-bff would not load.
  moduleNameMapper: {
    '^sanitize-html$': '<rootDir>/test/__helper__/sanitize-html-stub.ts',
  },
};
