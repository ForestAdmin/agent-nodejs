import type { EnvironmentVariables, Logger, Login } from './types';

// eslint-disable-next-line import/prefer-default-export
export const loginIfMissingAuthAndReturnEnvironmentVariables = async (
  login: Login,
  logger: Logger,
  getEnvironmentVariables: () => Promise<EnvironmentVariables>,
): Promise<EnvironmentVariables> => {
  const vars = await getEnvironmentVariables();
  if (vars.FOREST_AUTH_TOKEN) return vars;

  // must be sure to stop the spinner before calling login
  // because the spinner will clear the process.stdout
  logger.spinner.stop();
  await login(logger);

  return getEnvironmentVariables();
};
