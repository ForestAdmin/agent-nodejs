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
import { Logger, MakeCommands } from '../types';

const levelToLog = {
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
};

type SystemInfoLog = {
  level: 'Info';
  event: 'system';
  message: string;
};

type RequestInfoLog = {
  level: 'Info';
  event: 'request';
  method: string;
  status: number;
  path: string;
  duration: number;
};

type RequestWarnLog = {
  level: 'Warn';
  event: 'request';
  message: string;
  method: string;
  status: number;
  path: string;
  duration: number;
  error: {
    message: string;
    stack: string;
  };
};

type Log = SystemInfoLog | RequestInfoLog | RequestWarnLog;

const logMessage = (logger: Logger, { message }: { message: string }) => {
  try {
    const [timestamp, , , rawLogMessage] = message.split('\t');

    // Remove Datadog info if any..
    if (!/\{.*\}/.test(rawLogMessage)) return;

    const [unparsedLogMessage] = rawLogMessage.match(/\{.*\}/);
    const log: Log = JSON.parse(unparsedLogMessage);

    if (log.event === 'request') {
      const { level, method, status, path, duration } = log;
      const base = `[${status}] ${method} ${path} - ${duration}ms`;

      if (level === 'Info') return logger.info(base, timestamp);

      return logger[levelToLog[level]](
        `${base}\n\t${log.error.message}\t${log.error.stack}`,
        timestamp,
      );
    }

    return logger[levelToLog[log.level]](log.message, timestamp);
  } catch (e) {
    logger.warn(`Could not parse log message: ${message}`);
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
    }
  }
}

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, login, getEnvironmentVariables, buildHttpServer } = context;
  program
    .command('logs')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings. (env: FOREST_ENV_SECRET).',
    )
    .option(
      '-n, --tail <integer>',
      'Number of lines to show from the end of the logs. Default is 100.',
    )
    .description('Display the logs of the published customizations')
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

        const { logs } = await buildHttpServer(vars).getLogs(options.tail ?? 100);

        if (logs?.length > 0) logs.forEach(logMessage.bind(null, logger));
        else logger.spinner.warn('No logs available');
      }),
    );
};
