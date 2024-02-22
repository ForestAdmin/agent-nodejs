import askToOverwriteCustomizations from './dialogs/ask-to-overwrite-customizations';
import { BusinessError } from './errors';
import HttpServer from './services/http-server';
import { EnvironmentVariables, Logger, Login } from './types';

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
