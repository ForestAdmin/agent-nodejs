import { Command } from 'commander';
import { info } from 'node:console';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
import {
  validateEnvironmentVariables,
  validateMissingForestEnvSecret,
} from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

// MOVE TO internal logger https://vscode.dev/github/ForestAdmin/agent-nodejs/blob/add-logs/packages/forest-cloud/src/build-commands.ts#L23
const loggerPrefix = {
  Debug: '\x1b[34mdebug:\x1b[0m',
  Info: '\x1b[32minfo:\x1b[0m',
  Warn: '\x1b[33mwarning:\x1b[0m',
  Error: '\x1b[31merror:\x1b[0m',
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

const parseLogMessage = (rawLogMessage: string) => {
  // @ts-expect-error voila
  const { level, method, message, path, duration, status, event, error }: Log =
    JSON.parse(rawLogMessage);

  // TODO: Do something great about this
  switch (event) {
    case 'request':
      if (level === 'Info')
        return `${loggerPrefix[level]}[${status}] ${method} ${path} - ${duration}ms`;

      return (
        `${loggerPrefix[level]}[${status}] ${method} ${path} - ${duration}ms\n` +
        `\t${error.message}\t${error.stack}`
      );

    default:
      return loggerPrefix[level] + message;
  }
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
              logger.log(`${logTimestamp} | ${parseLogMessage(rawLogMessage)}`);
            });
        } else {
          logger.spinner.warn('No logs available');
        }
      }),
    );
};
