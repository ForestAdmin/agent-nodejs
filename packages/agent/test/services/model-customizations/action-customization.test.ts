import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionType,
  ActionScope as ConfigurationScope,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';

import ActionCustomizationService from '../../../src/services/model-customizations/action-customization';
import createWebhookExecutor from '../../../src/services/model-customizations/webhook-executor';
import { forestAdminHttpDriverOptions } from '../../__factories__';
import dataSourceCustomizerFactory from '../../__factories__/datasource-customizer';

jest.mock('../../../src/services/model-customizations/webhook-executor', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const createWebhookExecutorMock = createWebhookExecutor as jest.Mock;

describe('Services > ModelCustomizations > ActionCustomization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addWebhookActions', () => {
    it.each([
      { scope: ConfigurationScope.global, expectedScope: 'Global' },
      { scope: ConfigurationScope.single, expectedScope: 'Single' },
      { scope: ConfigurationScope.bulk, expectedScope: 'Bulk' },
    ] as Array<{ scope: ConfigurationScope; expectedScope: ActionScope }>)(
      'should register a webhook action with the scope $scope',
      async ({ scope, expectedScope }) => {
        const options = forestAdminHttpDriverOptions.build();

        const actionCustomization = new ActionCustomizationService(options);

        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: ActionType.webhook,
            scope,
            url: 'https://my-url.com',
          },
        };

        (
          options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
        ).mockResolvedValue([action]);

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        const webhookExecutor = jest.fn();
        createWebhookExecutorMock.mockReturnValue(webhookExecutor);

        await actionCustomization.addWebhookActions(customizer);

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope: expectedScope,
          execute: webhookExecutor,
        });
        expect(customizer.getCollection).toHaveBeenCalledWith('myModel');
        expect(
          options.forestAdminClient.modelCustomizationService.getConfiguration,
        ).toHaveBeenCalled();
        expect(createWebhookExecutorMock).toHaveBeenCalledWith(action);
      },
    );

    it('should throw an error for an unknown scope', async () => {
      const options = forestAdminHttpDriverOptions.build();

      const actionCustomization = new ActionCustomizationService(options);

      (
        options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
      ).mockResolvedValue([
        {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: ActionType.webhook,
            scope: 'unknown' as ConfigurationScope,
            url: 'https://my-url.com',
          },
        },
      ]);

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      (customizer.getCollection as jest.Mock).mockReturnValue({ addAction: jest.fn() });

      await expect(actionCustomization.addWebhookActions(customizer)).rejects.toThrow(
        'Unknown scope: unknown',
      );
    });

    it('should not use customizations that are not actions', async () => {
      const options = forestAdminHttpDriverOptions.build();

      const actionCustomization = new ActionCustomizationService(options);

      (
        options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
      ).mockResolvedValue([
        {
          name: 'myAction',
          type: 'field' as ModelCustomizationType,
          modelName: 'myModel',
          configuration: {
            type: ActionType.webhook,
            scope: ConfigurationScope.global,
            url: 'https://my-url.com',
          },
        },
      ]);

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await actionCustomization.addWebhookActions(customizer);

      expect(collection.addAction).not.toHaveBeenCalled();
    });

    it('should not use actions that are not webhooks', async () => {
      const options = forestAdminHttpDriverOptions.build();

      const actionCustomization = new ActionCustomizationService(options);

      (
        options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
      ).mockResolvedValue([
        {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'other' as ActionType,
            scope: ConfigurationScope.global,
            url: 'https://my-url.com',
          },
        },
      ]);

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await actionCustomization.addWebhookActions(customizer);

      expect(collection.addAction).not.toHaveBeenCalled();
    });
  });
});
