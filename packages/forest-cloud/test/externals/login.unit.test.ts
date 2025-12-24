import type { Logger } from '../../src/types';

import { exec } from 'child_process';
import { beforeEach } from 'node:test';

import login from '../../src/externals/login';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('login', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockClear();
  });

  describe('when the "login successful" message is not received', () => {
    it('should reject the login', async () => {
      const process = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn().mockImplementation((_, cb) => {
          cb();
        }),
      } as unknown as NodeJS.Process;
      (exec as unknown as jest.Mock).mockReturnValue(process);

      const logger: Logger = { write: jest.fn() } as unknown as Logger;

      await expect(login(logger)).rejects.toThrow('Login failed');

      expect(exec).toHaveBeenCalledWith(expect.any(String));
      expect(process.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(process.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });
});
