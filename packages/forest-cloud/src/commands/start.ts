import { Command } from 'commander';
import fs from 'fs';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
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
    generateDatasourceConfigFile,
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
            `Could not find configuration for your local datasource connection options. A new file (${distPathManager.localDatasourcesPath}) has been generated please complete it.`,
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
