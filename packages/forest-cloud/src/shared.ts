import askToOverwriteCustomizations from './dialogs/ask-to-overwrite-customizations';
import { BusinessError } from './errors';
import { validateEnvironmentVariables } from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import {
  BuildEventSubscriber,
  BuildHttpServer,
  EnvironmentVariables,
  Logger,
  Login,
} from './types';

export const validateAndBuildHttpServer = (
  envs: EnvironmentVariables,
  buildHttpServer: BuildHttpServer,
): HttpServer => {
  validateEnvironmentVariables(envs);

  return buildHttpServer(envs);
};

export const validateAndBuildEventSubscriber = (
  envs: EnvironmentVariables,
  buildEventSubscriber: BuildEventSubscriber,
): EventSubscriber => {
  validateEnvironmentVariables(envs);

  return buildEventSubscriber(envs);
};

export const loginIfMissingAuthAndReturnEnvironmentVariables = async (
  login: Login,
  logger: Logger,
  getEnvironmentVariables: () => Promise<EnvironmentVariables>,
): Promise<EnvironmentVariables> => {
  const vars = await getEnvironmentVariables();
  if (vars.FOREST_AUTH_TOKEN) return vars;

  await login(logger);

  return getEnvironmentVariables();
};

export const askToOverwriteCustomizationsOrAbortCommand = async (
  logger: Logger,
  httpServer: HttpServer,
): Promise<void> => {
  if (
    !(await askToOverwriteCustomizations(
      logger.spinner,
      httpServer.getLastPublishedCodeDetails.bind(httpServer),
    ))
  ) {
    throw new BusinessError('Operation aborted');
  }
};
