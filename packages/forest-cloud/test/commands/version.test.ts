import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('version command', () => {
  it('should display the version', async () => {
    const setup = setupCommandArguments({
      getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
    });
    const cmd = new CommandTester(setup, ['--version']);
    await cmd.run();

    expect(cmd.outputs).toEqual([cmd.logger.log('1.0.0'), cmd.spinner.stop()]);
  });

  describe('when the major version is greater', () => {
    it('should display a fail', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('2.0.0'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.logInfo('1.0.0'),
        cmd.fail(
          'Your version of @forestadmin/forest-cloud is outdated. Latest version is 2.0.0.' +
            '\nPlease update it to the latest major version to be able to use our services.',
        ),
        cmd.spinner.stop(),
      ]);
    });
  });

  describe('when the minor version is different', () => {
    it('should display a warning', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('1.0.1'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.logInfo('1.0.0'),
        cmd.warn(
          'Your version of @forestadmin/forest-cloud is outdated. Latest version is 1.0.1.' +
            '\nPlease update it.',
        ),
        cmd.spinner.stop(),
      ]);
    });
  });

  describe('when fails to fetch the version', () => {
    it('should display an info', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockRejectedValue(new Error('Failed to fetch')),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.logInfo('1.0.0'),
        cmd.info('Unable to check the latest version of @forestadmin/forest-cloud'),
      ]);
    });
  });

  describe('when the version is equal', () => {
    it('should only display the version', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('1.0.0'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([cmd.logInfo('1.0.0')]);
    });
  });
});
