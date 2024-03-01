import { Command } from 'commander';
import Joi from 'joi';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError, ValidationError } from '../errors';
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

function fromAndToValidator() {
  const dateMatchValidator = Joi.string().regex(/^now(-)\d+(s|m|H|h|d|w|M|y)(\/d)?$/);

  return Joi.alternatives([Joi.date(), dateMatchValidator]).optional();
}

function validateFromOption(from?: string) {
  if (!from) return;

  if (fromAndToValidator().validate(from).error) {
    throw new BusinessError(
      'The --from (-f) option must be a valid timestamp.' +
        ' You must enter a date (e.g: 2021-01-01T00:00:00.000Z) or' +
        ' match a relative date (e.g. now-1d)',
    );
  }
}

function validateToOption(to?: string) {
  if (Joi.alternatives(fromAndToValidator(), Joi.string().valid('now')).validate(to).error) {
    throw new BusinessError(
      'The --to (-t) option must be a valid timestamp.' +
        ' You must enter a date (e.g: 2021-01-01T00:00:00.000Z) or' +
        'match a relative date (e.g. now-1d)',
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
        ' Default is 30, Max is 1000. Use from option to get older logs.',
    )
    .option(
      '-f, --from <timestamp>',
      'Minimum timestamp for requested logs. Default is the last hour (now-1h)',
    )
    .option('-t, --to <timestamp>', 'Maximum timestamp for requested logs. Default is now')
    .description('Display logs of the customizations published on your agent')
    .action(
      actionRunner(
        logger.spinner,
        async (options: { envSecret: string; tail: number; from: string; to: string }) => {
          validateTailOption(options.tail);
          validateFromOption(options.from);
          validateToOption(options.to);
          const { spinner } = logger;
          const tail = Number(options.tail ?? 30);
          const from = options.from ?? 'now-1h';
          const to = options.to ?? 'now';

          await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);
          const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
            login,
            logger,
            getEnvironmentVariables,
          );

          vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
          validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');
          validateEnvironmentVariables(vars);

          let logs: Log[];

          try {
            logs = await buildHttpServer(vars).getLogs({
              from,
              to,
              limit: tail,
              // we want to get the logs from the oldest to the newest when we have a from option
              orderByRecentFirst: !options.from,
            });
          } catch (e) {
            if (e instanceof ValidationError) {
              logger.spinner.warn(`Given Options: from=${from}, to=${to}, tail=${tail}`);
            }

            throw e;
          }

          let message: string;
          let orderDetails: string;

          if (options.from && options.to) {
            orderDetails = '- Logs are returned from the oldest to the newest';
            message = `between "${from}" and "${to}"`;
          } else if (options.from) {
            orderDetails = '- Logs are returned from the oldest to the newest';
            message = `since "${from}"`;
          } else {
            orderDetails = '- Logs are returned from the newest to the oldest';
            message = `until "${to}"`;
          }

          const helperMessage =
            `You can increase your tail option to get more logs or ` +
            'increase/decrease your from and to options to get older or newer logs';

          if (logs?.length > 0) {
            logs.forEach(log => displayLog(logger, log));

            const pluralize = tail > 1 ? 's' : '';
            const baseMessage = `Requested ${tail} log${pluralize} ${message} ${orderDetails}`;
            const fromToMessage = `You have received logs from ${logs[0].timestamp} to ${
              logs[logs.length - 1].timestamp
            }`;

            if (logs.length === tail) {
              logger.log('...you have probably more logs...');
              logger.log(`${helperMessage}\n`);
              spinner.succeed(`${baseMessage}\n${fromToMessage}`);
            } else {
              spinner.succeed(
                `${baseMessage}, but only ${logs.length} were found\n${fromToMessage}`,
              );
            }
          } else {
            spinner.warn(`No logs found ${message}`);
            logger.log(helperMessage);
          }
        },
      ),
    );
};
