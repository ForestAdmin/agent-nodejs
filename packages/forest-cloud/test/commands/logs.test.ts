import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('logs command', () => {
  describe('when version is outdated', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('1.0.1'),
        getLogs: jest.fn().mockResolvedValue(['log1']),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.warn(
          // eslint-disable-next-line max-len
          'Your version of @forestadmin/forest-cloud is outdated. Latest version is 1.0.1.\nPlease update it.',
        ),
        cmd.start('Fetching logs'),
        cmd.succeed('Logs fetched'),
        cmd.log('log1'),
      ]);
    });
  });

  describe('when there is no logs', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue(null),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Fetching logs'),
        cmd.succeed('Logs fetched'),
        cmd.warn('No logs available'),
      ]);
    });
  });

  describe('when there is logs', () => {
    it('should display all the logs', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue(['log1', 'log2']),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Fetching logs'),
        cmd.succeed('Logs fetched'),
        cmd.log('log1'),
        cmd.log('log2'),
      ]);
    });
  });
});
