import CommandTester from './command-tester';
import { environmentVariables, setupCommandArguments } from './utils';

describe('logs command', () => {
  describe('when there is no env secret', () => {
    it('should display a fail message', async () => {
      const setup = setupCommandArguments({
        getEnvironmentVariables: jest.fn().mockResolvedValue({}),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
      ]);
    });
  });

  describe('when the -e option is given with an empty string', () => {
    it('should display a fail message', async () => {
      const setup = setupCommandArguments({
        getEnvironmentVariables: jest.fn().mockResolvedValue({}),
      });

      const cmd = new CommandTester(setup, ['logs', '-e', '']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
      ]);
    });
  });

  describe('when the --env-secret option is given with an empty string', () => {
    it('should display a fail message', async () => {
      const setup = setupCommandArguments({
        getEnvironmentVariables: jest.fn().mockResolvedValue({}),
      });

      const cmd = new CommandTester(setup, ['logs', '--env-secret', '']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
      ]);
    });
  });

  describe('when the env secret is given from options and null in the .env', () => {
    it('should fetch the logs', async () => {
      const setup = setupCommandArguments({
        getEnvironmentVariables: jest.fn().mockResolvedValue({
          ...environmentVariables,
          FOREST_ENV_SECRET: null,
        }),
      });

      const cmd = new CommandTester(setup, [
        'logs',
        '--env-secret',
        '32122032bc369ae171401fd8c586e84bc41bc9132cc5d22a7e096ae4735783c9',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([cmd.warn('No logs available')]);
    });
  });

  describe('when version is outdated', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('1.0.1'),
        getLogs: jest.fn().mockResolvedValue({ logs: ['log1'] }),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.warn(
          // eslint-disable-next-line max-len
          'Your version of @forestadmin/forest-cloud is outdated. Latest version is 1.0.1.\nPlease update it.',
        ),

        cmd.logInfo('log1'),
      ]);
    });
  });

  describe('when there is no logs', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue({ logs: [] }),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([cmd.warn('No logs available')]);
    });
  });

  describe('when there is logs', () => {
    it('should display all the logs', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue({
          logs: [
            {
              timestamp: 2,
              message: `timestamp\tlambdaRelatedData\tlambdaRelatedData\t${JSON.stringify({
                level: 'Info',
                event: 'system',
                message: 'System info message',
              })}`,
            },
            {
              timestamp: 2,
              message: `timestamp\tlambdaRelatedData\tlambdaRelatedData\t${JSON.stringify({
                level: 'Warn',
                event: 'system',
                message: 'System warn message',
              })}`,
            },
            {
              timestamp: 0,
              message: `timestamp\tlambdaRelatedData\tlambdaRelatedData\t${JSON.stringify({
                level: 'Error',
                event: 'system',
                message: 'System error message',
              })}`,
            },
            {
              timestamp: 0,
              message: `timestamp\tlambdaRelatedData\tlambdaRelatedData\t${JSON.stringify({
                level: 'Info',
                event: 'request',
                status: 200,
                method: 'GET',
                path: '/collection',
                duration: 42,
              })}`,
            },
            {
              timestamp: 0,
              message: `timestamp\tlambdaRelatedData\tlambdaRelatedData\t${JSON.stringify({
                level: 'Warn',
                event: 'request',
                status: 200,
                method: 'POST',
                path: '/collection/action',
                duration: 42,
                error: {
                  message: 'Error message',
                  stack: 'stack',
                },
              })}`,
            },
          ],
        }),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.logError('System error message'),
        cmd.logInfo('timestamp | [200] GET /collection - 42ms'),
        cmd.logWarn('timestamp | [200] POST /collection/action - 42ms\n\tError message\tstack'),
        cmd.logInfo('System info message'),
        cmd.logWarn('System warn message'),
      ]);
    });

    describe('when wants n last logs', () => {
      describe('when given a float instead of integer', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments({});

          const cmd = new CommandTester(setup, ['logs', '--tail', '2.5']);
          await cmd.run();

          expect(cmd.outputs).toEqual([cmd.fail('The --tail (-n) option must be an integer')]);
        });
      });

      it('should call getLogs to only request the n last logs', async () => {
        const getLogs = jest.fn().mockResolvedValue({ logs: [] });
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, ['logs', '--tail', '2']);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith('2');
      });

      // Not implemented with display all logs
      // eslint-disable-next-line jest/no-commented-out-tests
      // it('should display the logs with the n last logs', async () => {
      //   const getLogs = jest.fn().mockResolvedValue(['log1', 'log2']);
      //   const setup = setupCommandArguments({ getLogs });

      //   const cmd = new CommandTester(setup, ['logs', '--tail', '2']);
      //   await cmd.run();

      //   expect(cmd.outputs).toEqual([cmd.logInfo('log1'), cmd.logInfo('log2')]);
      //   expect(getLogs).toHaveBeenCalledWith('2');
      // });
    });
  });
});
