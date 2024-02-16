import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('version command', () => {
  it('should display the version', async () => {
    const setup = setupCommandArguments();
    const cmd = new CommandTester(setup, ['--version']);
    await cmd.run();

    expect(cmd.outputs).toEqual([expect.any(String)]);
  });

  describe('when the major version is greater', () => {
    it('should display a fail', async () => {
      const setup = setupCommandArguments({
        version: '1.0.0',
        getLatestVersion: jest.fn().mockResolvedValue('2.0.0'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.log('1.0.0'),
        cmd.fail(
          'Your version of @forestadmin/cloud-toolkit is outdated. Latest version is 2.0.0.' +
            '\nPlease update it to the latest major version to be able to use our services.',
        ),
      ]);
    });
  });

  describe('when the minor version is different', () => {
    it('should display a warning', async () => {
      const setup = setupCommandArguments({
        version: '1.0.0',
        getLatestVersion: jest.fn().mockResolvedValue('1.0.1'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.log('1.0.0'),
        cmd.warn(
          'Your version of @forestadmin/cloud-toolkit is outdated. Latest version is 1.0.1.' +
            '\nPlease update it.',
        ),
      ]);
    });
  });

  describe('when the version is equal', () => {
    it('should only display the version', async () => {
      const setup = setupCommandArguments({
        version: '1.0.0',
        getLatestVersion: jest.fn().mockResolvedValue('1.0.0'),
      });
      const cmd = new CommandTester(setup, ['--version']);
      await cmd.run();

      expect(cmd.outputs).toEqual([cmd.log('1.0.0')]);
    });
  });
});
