import ModelCustomizationWithCacheService from '../../src/model-customizations/model-customization-with-cache';
import ServerUtils from '../../src/utils/server';
import forestadminClientOptionsFactory from '../__factories__/forest-admin-client-options';

jest.mock('../../src/utils/server', () => ({
  query: jest.fn(),
}));

const ServerUtilsMock = ServerUtils as jest.Mocked<typeof ServerUtils>;

describe('ModelCustomizationWithCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfiguration', () => {
    it('should retrieve the configuration from the API', async () => {
      ServerUtilsMock.query.mockResolvedValueOnce([{ name: 'test' }]);

      const options = forestadminClientOptionsFactory.build();

      const modelCustomizations = new ModelCustomizationWithCacheService(options);

      const configuration = await modelCustomizations.getConfiguration();

      expect(configuration).toStrictEqual([{ name: 'test' }]);

      expect(ServerUtilsMock.query).toHaveBeenCalledTimes(1);
      expect(ServerUtilsMock.query).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/model-customizations',
      );
    });

    it('should not retrieve the configuration twice', async () => {
      ServerUtilsMock.query.mockResolvedValueOnce([{ name: 'test' }]);

      const options = forestadminClientOptionsFactory.build();

      const modelCustomizations = new ModelCustomizationWithCacheService(options);

      await modelCustomizations.getConfiguration();
      await modelCustomizations.getConfiguration();

      expect(ServerUtilsMock.query).toHaveBeenCalledTimes(1);
    });
  });
});
