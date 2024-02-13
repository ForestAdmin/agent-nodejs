import {
  getEnvironmentVariables,
  getOrRefreshEnvironmentVariables,
  validateEnvironmentVariables,
  validateServerUrl,
} from '../../src/services/environment-variables';

describe('actionRunner', () => {
  const setup = () => {};

  describe('getEnvironmentVariables', () => {
    it('should build the env variables', async () => {
      expect(getEnvironmentVariables()).toEqual({});
    });
  });
});
