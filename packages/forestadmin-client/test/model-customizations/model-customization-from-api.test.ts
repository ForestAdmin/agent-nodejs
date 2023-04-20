import ModelCustomizationService from '../../src/model-customizations/model-customization-from-api';
import {
  ActionScope,
  ModelCustomization,
  WebhookActionConfigurationApi,
} from '../../src/model-customizations/types';
import ServerUtils from '../../src/utils/server';
import forestadminClientOptionsFactory from '../__factories__/forest-admin-client-options';

jest.mock('../../src/utils/server', () => ({
  query: jest.fn(),
}));

const ServerUtilsMock = ServerUtils as jest.Mocked<typeof ServerUtils>;

describe('ModelCustomizationFromApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfiguration', () => {
    describe('with actions', () => {
      describe('with webhooks', () => {
        it.each(['Global', 'Bulk', 'Single'] as ActionScope[])(
          'should retrieve the configuration from the API and map values for the scope %s',
          async scope => {
            ServerUtilsMock.query.mockResolvedValueOnce([
              {
                name: 'test',
                type: 'action',
                modelName: 'myModel',
                configuration: {
                  type: 'webhook',
                  scope: scope.toLowerCase(),
                  url: 'https://my-url.com',
                  integration: 'service',
                },
              },
            ] as ModelCustomization<WebhookActionConfigurationApi>[]);

            const options = forestadminClientOptionsFactory.build();

            const modelCustomizations = new ModelCustomizationService(options);

            const configuration = await modelCustomizations.getConfiguration();

            expect(configuration).toStrictEqual([
              {
                name: 'test',
                type: 'action',
                modelName: 'myModel',
                configuration: {
                  type: 'webhook',
                  scope,
                  url: 'https://my-url.com',
                  integration: 'service',
                },
              },
            ]);

            expect(ServerUtilsMock.query).toHaveBeenCalledTimes(1);
            expect(ServerUtilsMock.query).toHaveBeenCalledWith(
              options,
              'get',
              '/liana/model-customizations',
            );
          },
        );
      });
    });

    describe('with unsupported types', () => {
      it('should throw an error', async () => {
        ServerUtilsMock.query.mockResolvedValueOnce([
          {
            name: 'test',
            type: 'unsupported',
            modelName: 'myModel',
            configuration: {},
          },
        ]);

        const options = forestadminClientOptionsFactory.build();

        const modelCustomizations = new ModelCustomizationService(options);

        await expect(modelCustomizations.getConfiguration()).rejects.toThrow(
          'Only action customizations are supported for now.',
        );
      });
    });
  });
});
