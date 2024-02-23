import { exec } from 'child_process';
import { beforeEach } from 'node:test';

import login from '../src/login';
import { Logger } from '../src/types';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('login', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockClear();
  });

  it('should call the login from the bin', async () => {
    const process = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn().mockImplementation((_, cb) => {
        cb();
      }),
    } as unknown as NodeJS.Process;
    (exec as unknown as jest.Mock).mockReturnValue(process);

    const logger: Logger = {
      spinner: { start: jest.fn(), stop: jest.fn() },
      log: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    await login(logger);

    expect(exec).toHaveBeenCalledWith(expect.any(String));
    expect(process.stdout.on).toHaveBeenCalledWith('data', logger.log);
    expect(process.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('close', expect.any(Function));
  });
});
