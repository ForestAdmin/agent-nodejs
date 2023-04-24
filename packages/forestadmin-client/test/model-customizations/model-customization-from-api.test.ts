import ModelCustomizationService from '../../src/model-customizations/model-customization-from-api';
import {
  ActionScope,
  ModelCustomization,
  WebhookActionConfigurationApi,
} from '../../src/model-customizations/types';
import { forestAdminServerInterface } from '../__factories__';
import forestadminClientOptionsFactory from '../__factories__/forest-admin-client-options';

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
            const forestadminServer = forestAdminServerInterface.build();
            (forestadminServer.getModelCustomizations as jest.Mock).mockResolvedValueOnce([
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

            const modelCustomizations = new ModelCustomizationService(forestadminServer, options);

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

            expect(forestadminServer.getModelCustomizations).toHaveBeenCalledTimes(1);
            expect(forestadminServer.getModelCustomizations).toHaveBeenCalledWith(options);
          },
        );
      });
    });

    describe('with unsupported types', () => {
      it('should throw an error', async () => {
        const options = forestadminClientOptionsFactory.build();
        const forestadminServer = forestAdminServerInterface.build();

        (forestadminServer.getModelCustomizations as jest.Mock).mockResolvedValueOnce([
          {
            name: 'test',
            type: 'unsupported',
            modelName: 'myModel',
            configuration: {},
          },
        ]);

        const modelCustomizations = new ModelCustomizationService(forestadminServer, options);

        await expect(modelCustomizations.getConfiguration()).rejects.toThrow(
          'Only action customizations are supported for now.',
        );
      });
    });
  });
});
