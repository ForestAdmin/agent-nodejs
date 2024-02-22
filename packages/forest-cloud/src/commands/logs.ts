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

const logMessage = (logger: Logger, rawLogMessage: string, timestamp: string) => {
  const log: Log = JSON.parse(rawLogMessage);

  if (log.event === 'request') {
    const { level, method, status, path, duration } = log;
    const base = `${timestamp} | [${status}] ${method} ${path} - ${duration}ms`;

    if (level === 'Info') return logger.info(base);

    return logger[levelToLog[level]](`${base}\n\t${log.error.message}\t${log.error.stack}`);
  }

  return logger[levelToLog[log.level]](log.message);
};

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, login, getEnvironmentVariables, buildHttpServer } = context;
  program
    .command('logs')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings. (env: FOREST_ENV_SECRET)',
    )
    .option('-n, --tail <integer>', 'Number of lines to show from the end of the logs')
    .description('Display the logs of the published customizations')
    .action(
      actionRunner(logger.spinner, async (options: { envSecret: string; tail: number }) => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        if (options.tail !== undefined && !Number.isInteger(Number(options.tail))) {
          throw new BusinessError('The --tail (-n) option must be an integer');
        }

        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
        validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');

        validateEnvironmentVariables(vars);

        const { logs } = await buildHttpServer(vars).getLogs(options.tail);

        if (logs?.length > 0) {
          logger.spinner.stop();
          logs
            // Rebuild order
            .sort((a, b) => a.timestamp - b.timestamp)
            .forEach(({ message }) => {
              const [logTimestamp, , , rawLogMessage] = message.split('\t');
              // Remove Datadog info if any..
              const [unparsedLogMessage] = rawLogMessage.match(/\{.*\}/);
              logMessage(logger, unparsedLogMessage, logTimestamp);
            });
        } else {
          logger.spinner.warn('No logs available');
        }
      }),
    );
};
