import type { MakeCommands } from '../types';
import type { Command } from 'commander';

import fs from 'fs';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
import { validateEnvironmentVariables } from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { startingAgent } from '../services/starting-agent-locally';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';

export default (program: Command, context: MakeCommands) => {
  const {
    logger,
    getCurrentVersion,
    buildHttpServer,
    login,
    getEnvironmentVariables,
    generateDatasourceConfigFile,
    distPathManager,
  } = context;

  const agentLogger = (level: string, ...args: unknown[]) => {
    const loggerLevel = process.env.LOG_LEVEL ?? 'Info';
    const levels = ['Debug', 'Info', 'Warn', 'Error'];

    if (levels.indexOf(level) >= levels.indexOf(loggerLevel)) {
      logger[level.toLowerCase()](...args);
    }
  };

  program
    .command('start')
    .description(
      'Starts the agent locally to test your code customizations before publishing to your production environment.',
    )
    .action(
      actionRunner(logger.spinner, async () => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        logger.info('Starting agent locally…');
        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );
        validateEnvironmentVariables(vars);

        // Check that /d.forest/.environments does contains env secret yet
        if (!fs.existsSync(distPathManager.localCloudEnvironmentConfigPath)) {
          fs.writeFileSync(distPathManager.localCloudEnvironmentConfigPath, JSON.stringify({}));
        }

        // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
        const localCloudEnvironmentsConfig = require(distPathManager.localCloudEnvironmentConfigPath);

        let environmentSecret = localCloudEnvironmentsConfig[`${vars.FOREST_ENV_SECRET}`];

        if (!environmentSecret) {
          environmentSecret = (await buildHttpServer(vars).getOrCreateNewDevelopmentEnvironment())
            .data.attributes.secret_key;

          // Add it to local variables
          localCloudEnvironmentsConfig[`${vars.FOREST_ENV_SECRET}`] = environmentSecret;
          fs.writeFileSync(
            distPathManager.localCloudEnvironmentConfigPath,
            JSON.stringify(localCloudEnvironmentsConfig),
          );
        }

        // Check that the user has the datasource connection options file
        if (!fs.existsSync(distPathManager.localDatasourcesPath)) {
          await generateDatasourceConfigFile(distPathManager.localDatasourcesPath);
          throw new BusinessError(
            `Could not find configuration for your local datasource connection options. A new file (${distPathManager.localDatasourcesPath}) has been generated. Please complete it with your local database credentials.`,
          );
        }

        await startingAgent(
          distPathManager,
          { forestServerUrl: vars.FOREST_SERVER_URL, envSecret: environmentSecret },
          agentLogger,
        );
      }),
    );
};
