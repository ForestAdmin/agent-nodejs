import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { validateEnvironmentVariables } from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { startingAgent } from '../services/starting-agent-locally';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const {
    logger,
    getCurrentVersion,
    buildHttpServer,
    login,
    getEnvironmentVariables,
    distPathManager,
  } = context;

  const agentLogger = (level: string, ...args: unknown[]) => {
    const lowerCaseLevel = level.toLowerCase();

    if (['debug', 'info', 'warn', 'error'].includes(lowerCaseLevel)) {
      logger[lowerCaseLevel](...args);
    }
  };

  program
    .command('start')
    .description(
      'Starts the agent locally to allow easier work flow before publish to Cloud Production',
    )
    .action(
      actionRunner(logger.spinner, async () => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        logger.info('Starting agent locally..');
        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );
        validateEnvironmentVariables(vars);

        const datasources = await buildHttpServer(vars).getDatasources();

        await startingAgent(distPathManager, datasources, vars, agentLogger);
      }),
    );
};
