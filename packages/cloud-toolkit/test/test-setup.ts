import dotenv from 'dotenv';
import fsP from 'fs/promises';
import path from 'path';

const filename = process.env.DOTENV_CONFIG_PATH || '.env-test';
dotenv.config({ path: path.resolve(__dirname, `../${filename}`) });

jest.mock('fs/promises');
export const mockedFsP = fsP as jest.Mocked<typeof fsP> & jest.Mock;
mockedFsP.rm = jest.fn();

// Console mocks
export const consoleMocks = {
  warn: jest.spyOn(global.console, 'warn'),
  log: jest.spyOn(global.console, 'log'),
};
