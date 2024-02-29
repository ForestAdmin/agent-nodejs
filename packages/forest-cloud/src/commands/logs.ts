import { Command } from 'commander';
import Joi from 'joi';

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
  if (tail === undefined) return;

  if (Joi.number().integer().validate(tail).error) {
    throw new BusinessError('The --tail (-n) option must be an integer');
  } else if (Joi.number().positive().validate(tail).error) {
    throw new BusinessError('The --tail (-n) option must be a positive integer');
  } else if (Joi.number().max(1000).validate(tail).error) {
    throw new BusinessError('The --tail (-n) option must be equal or less than 1000');
  }
}

function validateFromOption(from?: string) {
  if (from === undefined) return;
  const dateMatchValidator = Joi.string().regex(/^now(-)\d+(s|m|H|h|d|w|M|y)(\/d)?$/);
  const validator = Joi.alternatives([Joi.date(), dateMatchValidator]).optional();

  if (validator.validate(from).error) {
    throw new BusinessError(
      'The --from (-f) option must be a valid timestamp.' +
        ' You must match this regex: /^now-\\d+(s|m|H|h|d|w|M|y)(\\/d)?$) or a valid date',
    );
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
      'Number of lines to show from the end of the logs in the last hour.' +
        ' Default is 30, Max is 1000',
    )
    .option(
      '-f, --from <timestamp>',
      'Minimum timestamp for requested logs. Default is the last hour (now-1h)',
    )
    .description('Display logs of the customizations published on your agent')
    .action(
      actionRunner(
        logger.spinner,
        async (options: { envSecret: string; tail: number; from: string }) => {
          validateTailOption(options.tail);
          validateFromOption(options.from);
          const tail = options.tail ?? 30;
          const from = options.from ?? 'now-1h';

          await checkLatestVersion(
            logger.spinner,
            getCurrentVersion(),
            HttpServer.getLatestVersion,
          );

          const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
            login,
            logger,
            getEnvironmentVariables,
          );

          vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
          validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');
          validateEnvironmentVariables(vars);

          const { logs } = await buildHttpServer(vars).getLogs({ from, tail });

          const fromMessage = from === 'now-1h' ? 'in the last hour' : `from ${from}`;
          if (logs?.length > 0) {
            const pluralize = tail > 1 ? 's' : '';
            const baseMessage = `Requested ${tail} log${pluralize} ${fromMessage}`;

            if (logs.length === Number(tail)) {
              logger.spinner.succeed(baseMessage);
            } else {
              logger.spinner.succeed(`${baseMessage}, but only ${logs.length} were found`);
            }

            logs.forEach(log => displayLog(logger, log));
          } else logger.spinner.warn(`No logs found ${fromMessage}`);
        },
      ),
    );
};
