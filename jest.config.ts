import type { Config } from '@jest/types';

import path from 'path';

const ESM_ONLY_DEPENDENCIES =
  '(?:htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)';
const ESM_TRANSFORMER = path.join(__dirname, 'jest.esm-transformer.js');

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    '<rootDir>/packages/*/src/**/*.ts',
    '!<rootDir>/packages/_example/src/**/*.ts',
    '!<rootDir>/packages/datasource-customizer/src/decorators/search/generated-parser/*.ts',
  ],
  testMatch: ['<rootDir>/packages/*/test/**/*.test.ts'],
  setupFilesAfterEnv: ['jest-extended/all'],
  transform: {
    [`/node_modules/${ESM_ONLY_DEPENDENCIES}/.+\\.js$`]: ESM_TRANSFORMER,
  },
  transformIgnorePatterns: [`/node_modules/(?!(?:.*/node_modules/)?${ESM_ONLY_DEPENDENCIES}/)`],
};
export default config;
