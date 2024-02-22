import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('login command', () => {
  it('should login correctly', async () => {
    const getEnvironmentVariables = jest
      .fn()
      .mockReturnValue({ FOREST_SERVER_URL: 'https://some.wrong.url' });
    const login = jest.fn();
    const setup = setupCommandArguments({ getEnvironmentVariables, login });

    const cmd = new CommandTester(setup, ['login']);
    await cmd.run();

    expect(login).toHaveBeenCalled();
    expect(cmd.outputs).toEqual([
      cmd.spinner.start('Logging in'),
      cmd.spinner.succeed('You are now logged in'),
    ]);
  });

  describe('when forest server url is missing', () => {
    it('should throw an error', async () => {
      const getEnvironmentVariables = jest.fn().mockReturnValue({});
      const setup = setupCommandArguments({ getEnvironmentVariables });

      const cmd = new CommandTester(setup, ['login']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Logging in'),
        cmd.spinner.fail('Missing FOREST_SERVER_URL. Please check your .env file.'),
      ]);
    });
  });

  describe('when server URL is invalid', () => {
    it('should throw an error', async () => {
      const getEnvironmentVariables = jest
        .fn()
        .mockReturnValue({ FOREST_SERVER_URL: 'some.wrong.url' });

      const setup = setupCommandArguments({ getEnvironmentVariables });

      const cmd = new CommandTester(setup, ['login']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Logging in'),
        cmd.spinner.fail('FOREST_SERVER_URL is invalid. Please check your .env file.\nInvalid URL'),
      ]);
    });
  });

  describe("when server URL doesn't start with http", () => {
    it('should throw an error', async () => {
      const getEnvironmentVariables = jest
        .fn()
        .mockReturnValue({ FOREST_SERVER_URL: 'ws://some.wrong.url' });
      const setup = setupCommandArguments({ getEnvironmentVariables });

      const cmd = new CommandTester(setup, ['login']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Logging in'),
        cmd.spinner.fail(
          "FOREST_SERVER_URL is invalid, it must start with 'http://' or 'https://'. Please check your .env file.",
        ),
        cmd.spinner.stop(),
      ]);
    });
  });
});
