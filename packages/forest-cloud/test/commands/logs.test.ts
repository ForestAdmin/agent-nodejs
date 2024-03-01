import CommandTester from './command-tester';
import { environmentVariables, setupCommandArguments } from './utils';
import { ValidationError } from '../../src/errors';

describe('logs command', () => {
  describe('when there is no env secret', () => {
    it('should display a fail message', async () => {
      const setup = setupCommandArguments({
        getEnvironmentVariables: jest.fn().mockResolvedValue({}),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.stop(),
        cmd.spinner.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
        cmd.spinner.stop(),
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
        cmd.spinner.stop(),
        cmd.spinner.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
        cmd.spinner.stop(),
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
        cmd.spinner.stop(),
        cmd.spinner.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `logs --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
        cmd.spinner.stop(),
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
        getLogs: jest.fn().mockResolvedValue([]),
      });

      const cmd = new CommandTester(setup, [
        'logs',
        '--env-secret',
        '32122032bc369ae171401fd8c586e84bc41bc9132cc5d22a7e096ae4735783c9',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.warn('No logs found in the last month'),
        cmd.logger.log(
          // eslint-disable-next-line max-len
          'By default, the last 30 logs from the past month are displayed. To see more logs or change the time range, use --help for all options',
        ),
        cmd.spinner.stop(),
      ]);
    });
  });

  describe('when version is outdated', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
        getLatestVersion: jest.fn().mockResolvedValue('1.0.1'),
        getLogs: jest.fn().mockResolvedValue([]),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual(
        expect.arrayContaining([
          cmd.spinner.warn(
            // eslint-disable-next-line max-len
            'Your version of @forestadmin/forest-cloud is outdated. Latest version is 1.0.1.\nPlease update it.',
          ),
        ]),
      );
    });
  });

  describe('when there is no logs', () => {
    it('should display a warning message', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue([]),
      });

      const cmd = new CommandTester(setup, ['logs']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.warn('No logs found in the last month'),
        cmd.logger.log(
          // eslint-disable-next-line max-len
          'By default, the last 30 logs from the past month are displayed. To see more logs or change the time range, use --help for all options',
        ),
        cmd.spinner.stop(),
      ]);
    });

    describe('when the from is given', () => {
      it('should display the given from in the message', async () => {
        const getLogs = jest.fn().mockResolvedValue([]);
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, ['logs', '--from', '2021-05-01T00:00:00Z']);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith({
          from: '2021-05-01T00:00:00Z',
          limit: 30,
          orderByRecentFirst: false,
          to: 'now',
        });

        expect(cmd.outputs).toEqual([
          cmd.spinner.warn(
            // eslint-disable-next-line max-len
            'No logs found since "2021-05-01T00:00:00Z"',
          ),
          cmd.logger.log('To see more logs or change the time range, use --help for all options'),
          cmd.spinner.stop(),
        ]);
      });
    });
  });

  describe('when there are logs', () => {
    it('should display all the logs', async () => {
      const setup = setupCommandArguments({
        getLogs: jest.fn().mockResolvedValue([
          { timestamp: '2', message: 'a-message', level: 'Info' },
          { timestamp: '3', message: 'a-message', level: 'Warn' },
          { timestamp: '4', message: 'a-message' },
        ]),
      });

      const cmd = new CommandTester(setup, ['logs', '--tail', '3']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.logger.info('a-message').prefixed('2'),
        cmd.logger.warn('a-message').prefixed('3'),
        cmd.logger.log('a-message').prefixed('4'),
        cmd.logger.log('...you have probably more logs...'),
        cmd.spinner.succeed(
          // eslint-disable-next-line max-len
          'Requested 3 logs in the last month - Logs are returned from the newest to the oldest\nYou have received logs from 2 to 4\n',
        ),
        cmd.logger.log('To see more logs or change the time range, use --help for all options'),
        cmd.spinner.stop(),
      ]);
    });

    describe('when the log is unprocessable', () => {
      it('should display the log with a warning message', async () => {
        const setup = setupCommandArguments({
          getLogs: jest
            .fn()
            .mockResolvedValue([{ timestamp: '3', message: 'a-message', level: 'BAD_LEVEL' }]),
        });

        const cmd = new CommandTester(setup, ['logs']);
        await cmd.run();

        expect(cmd.outputs).toEqual([
          cmd.logger.log('a-message').prefixed('3'),
          cmd.spinner.succeed(
            // eslint-disable-next-line max-len
            'Requested 30 logs in the last month - Logs are returned from the newest to the oldest, but only 1 were found\nYou have received logs from 3 to 3',
          ),
          cmd.spinner.stop(),
        ]);
      });
    });

    describe('when the n option is given', () => {
      describe('when given a float instead of integer', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--tail', '2.5']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail('The --tail (-n) option must be an integer'),
            cmd.spinner.stop(),
          ]);
        });
      });

      describe('when given a negative value instead of positive integer', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--tail', '-2']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail('The --tail (-n) option must be a positive integer'),
            cmd.spinner.stop(),
          ]);
        });
      });

      describe('when given a too big value', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--tail', '10001']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail('The --tail (-n) option must be equal or less than 1000'),
            cmd.spinner.stop(),
          ]);
        });
      });

      it('should call getLogs to only request the n last logs', async () => {
        const getLogs = jest.fn().mockResolvedValue([]);
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, ['logs', '--tail', '2']);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith({
          from: 'now-1M',
          limit: 2,
          orderByRecentFirst: true,
          to: 'now',
        });
      });
    });

    describe('when the from option is given', () => {
      it('should add the given "from" to the success message', async () => {
        const getLogs = jest
          .fn()
          .mockResolvedValue([{ timestamp: '2', message: 'a-message', level: 'Info' }]);
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, ['logs', '--from', '2021-05-01T00:00:00Z']);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith({
          from: '2021-05-01T00:00:00Z',
          limit: 30,
          orderByRecentFirst: false,
          to: 'now',
        });

        expect(cmd.outputs).toEqual([
          cmd.logger.info('a-message').prefixed('2'),
          cmd.spinner.succeed(
            // eslint-disable-next-line max-len
            'Requested 30 logs since "2021-05-01T00:00:00Z" - Logs are returned from the oldest to the newest, but only 1 were found\nYou have received logs from 2 to 2',
          ),
          cmd.spinner.stop(),
        ]);
      });

      describe('when is not a valid date', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--from', 'not-a-date']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail(
              // eslint-disable-next-line max-len
              'The --from (-f) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) or match a relative date (e.g. now-1d)',
            ),
            cmd.spinner.stop(),
          ]);
        });
      });

      describe('when is not a valid format for the now syntax', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--from', 'now-bad']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail(
              // eslint-disable-next-line max-len
              'The --from (-f) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) or match a relative date (e.g. now-1d)',
            ),
            cmd.spinner.stop(),
          ]);
        });

        describe('when now is used with a +', () => {
          it('should display a fail message', async () => {
            const setup = setupCommandArguments();

            const cmd = new CommandTester(setup, ['logs', '--from', 'now+1h']);
            await cmd.run();

            expect(cmd.outputs).toEqual([
              cmd.spinner.fail(
                // eslint-disable-next-line max-len
                'The --from (-f) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) or match a relative date (e.g. now-1d)',
              ),
              cmd.spinner.stop(),
            ]);
          });
        });
      });

      describe('when it is a valid date', () => {
        it('should call getLogs with the given from', async () => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '--from', '2021-05-01T00:00:00Z']);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from: '2021-05-01T00:00:00Z',
            limit: 30,
            orderByRecentFirst: false,
            to: 'now',
          });
        });
      });

      describe('when the from is given with the -f option', () => {
        it('should call getLogs with the given from', async () => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '-f', '2021-05-01T00:00:00Z']);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from: '2021-05-01T00:00:00Z',
            limit: 30,
            orderByRecentFirst: false,
            to: 'now',
          });
        });
      });

      it.each(['now-1M', 'now-1m', 'now-1s', 'now-1d', 'now-1w', 'now-1M', 'now-1y'])(
        `when %s should call getLogs with the given from`,
        async from => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '--from', from]);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from,
            limit: 30,
            orderByRecentFirst: false,
            to: 'now',
          });
        },
      );
    });

    describe('when the to option is given', () => {
      it('should add the given "to" to the success message', async () => {
        const getLogs = jest
          .fn()
          .mockResolvedValue([{ timestamp: '2', message: 'a-message', level: 'Info' }]);
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, ['logs', '--to', '2021-05-01T00:00:00Z']);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith({
          from: 'now-1M',
          limit: 30,
          orderByRecentFirst: true,
          to: '2021-05-01T00:00:00Z',
        });

        expect(cmd.outputs).toEqual([
          cmd.logger.info('a-message').prefixed('2'),
          cmd.spinner.succeed(
            // eslint-disable-next-line max-len
            'Requested 30 logs until "2021-05-01T00:00:00Z" - Logs are returned from the newest to the oldest, but only 1 were found\nYou have received logs from 2 to 2',
          ),
          cmd.spinner.stop(),
        ]);
      });

      describe('when is not a valid date', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--to', 'not-a-date']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail(
              // eslint-disable-next-line max-len
              'The --to (-t) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) ormatch a relative date (e.g. now-1d)',
            ),
            cmd.spinner.stop(),
          ]);
        });
      });

      describe('when is not a valid format for the now syntax', () => {
        it('should display a fail message', async () => {
          const setup = setupCommandArguments();

          const cmd = new CommandTester(setup, ['logs', '--to', 'now-bad']);
          await cmd.run();

          expect(cmd.outputs).toEqual([
            cmd.spinner.fail(
              // eslint-disable-next-line max-len
              'The --to (-t) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) ormatch a relative date (e.g. now-1d)',
            ),
            cmd.spinner.stop(),
          ]);
        });

        describe('when now is used with a +', () => {
          it('should display a fail message', async () => {
            const setup = setupCommandArguments();

            const cmd = new CommandTester(setup, ['logs', '--to', 'now+1h']);
            await cmd.run();

            expect(cmd.outputs).toEqual([
              cmd.spinner.fail(
                // eslint-disable-next-line max-len
                'The --to (-t) option must be a valid timestamp. You must enter a date (e.g: 2021-01-01T00:00:00.000Z) ormatch a relative date (e.g. now-1d)',
              ),
              cmd.spinner.stop(),
            ]);
          });
        });
      });

      describe('when it is a valid date', () => {
        it('should call getLogs with the given from', async () => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '--to', '2021-05-01T00:00:00Z']);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from: 'now-1M',
            limit: 30,
            orderByRecentFirst: true,
            to: '2021-05-01T00:00:00Z',
          });
        });
      });

      describe('when the to is given with the -t option', () => {
        it('should call getLogs with the given from', async () => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '-t', '2021-05-01T00:00:00Z']);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from: 'now-1M',
            limit: 30,
            orderByRecentFirst: true,
            to: '2021-05-01T00:00:00Z',
          });
        });
      });

      it.each(['now-1M', 'now-1m', 'now-1s', 'now-1d', 'now-1w', 'now-1M', 'now-1y', 'now'])(
        `when %s should call getLogs with the given to`,
        async to => {
          const getLogs = jest.fn().mockResolvedValue([]);
          const setup = setupCommandArguments({ getLogs });

          const cmd = new CommandTester(setup, ['logs', '--to', to]);
          await cmd.run();

          expect(getLogs).toHaveBeenCalledWith({
            from: 'now-1M',
            limit: 30,
            orderByRecentFirst: true,
            to,
          });
        },
      );
    });

    describe('when the to and from options are given', () => {
      it('should display the given from and to in the message', async () => {
        const getLogs = jest
          .fn()
          .mockResolvedValue([{ timestamp: '2', message: 'a-message', level: 'Info' }]);
        const setup = setupCommandArguments({ getLogs });

        const cmd = new CommandTester(setup, [
          'logs',
          '--from',
          '2021-05-01T00:00:00Z',
          '--to',
          '2021-05-02T00:00:00Z',
        ]);
        await cmd.run();

        expect(getLogs).toHaveBeenCalledWith({
          from: '2021-05-01T00:00:00Z',
          limit: 30,
          orderByRecentFirst: false,
          to: '2021-05-02T00:00:00Z',
        });

        expect(cmd.outputs).toEqual([
          cmd.logger.info('a-message').prefixed('2'),
          cmd.spinner.succeed(
            // eslint-disable-next-line max-len
            'Requested 30 logs between "2021-05-01T00:00:00Z" and "2021-05-02T00:00:00Z" - Logs are returned from the oldest to the newest, but only 1 were found\nYou have received logs from 2 to 2',
          ),
          cmd.spinner.stop(),
        ]);
      });
    });
  });

  describe('when the failing to fetch logs', () => {
    describe('when it is a validation error', () => {
      it('should display a fail message', async () => {
        const setup = setupCommandArguments({
          getLogs: jest.fn().mockRejectedValue(new ValidationError('Validation error')),
        });

        const cmd = new CommandTester(setup, ['logs']);
        await cmd.run();

        expect(cmd.outputs).toEqual([
          cmd.spinner.warn('Given Options: from=now-1M, to=now, tail=30'),
          cmd.spinner.fail('Validation error'),
          cmd.spinner.stop(),
        ]);
      });
    });
  });
});
