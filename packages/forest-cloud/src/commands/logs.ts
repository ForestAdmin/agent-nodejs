import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
import {
  validateEnvironmentVariables,
  validateMissingForestEnvSecret,
} from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { Log, Logger, MakeCommands } from '../types';

const levelToLog = {
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
};

const displayLog = (logger: Logger, log: Log) => {
  try {
    logger[levelToLog[log.level]](log.message, log.timestamp);
  } catch (e) {
    logger.log(log.message, log.timestamp);
  }
};

function validateTailOption(tail?: unknown) {
  if (tail !== undefined) {
    if (!Number.isInteger(Number(tail))) {
      throw new BusinessError('The --tail (-n) option must be an integer');
    } else if (Number(tail) < 0) {
      throw new BusinessError('The --tail (-n) option must be a positive integer');
    } else if (Number(tail) === 0) {
      throw new BusinessError('The --tail (-n) option must be greater than 0');
    } else if (Number(tail) > 1000) {
      throw new BusinessError('The --tail (-n) option must be equal or less than 1000');
    }
  }
}

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, login, getEnvironmentVariables, buildHttpServer } = context;
  program
    .command('logs')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings.' +
        ' (you can also pass it with environment variable FOREST_ENV_SECRET)',
    )
    .option(
      '-n, --tail <integer>',
      'Number of lines to show from the end of the logs. Default is 30, Max is 1000',
    )
    .description('Display logs of the customizations published on your agent.')
    .action(
      actionRunner(logger.spinner, async (options: { envSecret: string; tail: number }) => {
        validateTailOption(options.tail);
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
        validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');
        validateEnvironmentVariables(vars);

        const { logs } = await buildHttpServer(vars).getLogs(options.tail ?? 30);

        if (logs?.length > 0) logs.forEach(log => displayLog(logger, log));
        else logger.spinner.warn('No logs available');
      }),
    );
};
