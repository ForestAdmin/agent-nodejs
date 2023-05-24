import { ActionContext, CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionType,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';

import ActionCustomizationService from '../../../src/services/model-customizations/action-customization';
import executeWebhook from '../../../src/services/model-customizations/execute-webhook';
import { forestAdminHttpDriverOptions } from '../../__factories__';
import dataSourceCustomizerFactory from '../../__factories__/datasource-customizer';

jest.mock('../../../src/services/model-customizations/execute-webhook', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const executeWebhookMock = executeWebhook as jest.Mock;

describe('Services > ModelCustomizations > ActionCustomization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addWebhookActions', () => {
    it.each(['Global', 'Single', 'Bulk'] as ActionScope[])(
      'should register a webhook action with the scope $scope',
      async scope => {
        const options = forestAdminHttpDriverOptions.build();

        const actionCustomization = new ActionCustomizationService(options);

        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'webhook',
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

        await actionCustomization.addWebhookActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          true,
        );

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope,
          execute: expect.any(Function),
        });
        expect(customizer.getCollection).toHaveBeenCalledWith('myModel');
        expect(
          options.forestAdminClient.modelCustomizationService.getConfiguration,
        ).toHaveBeenCalled();
      },
    );

    it('should execute the webhook', async () => {
      const options = forestAdminHttpDriverOptions.build();

      const actionCustomization = new ActionCustomizationService(options);

      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myModel',
        configuration: {
          type: 'webhook',
          scope: 'Global',
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

      await actionCustomization.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        true,
      );

      const { execute } = collection.addAction.mock.calls[0][1];

      const context = { getRecords: jest.fn() } as unknown as ActionContext;

      await execute(context);

      expect(executeWebhookMock).toHaveBeenCalledWith(action, context);
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
            type: 'webhook',
            scope: 'Global',
            url: 'https://my-url.com',
          },
        },
      ]);

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await actionCustomization.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        true,
      );

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
            scope: 'Global',
            url: 'https://my-url.com',
          },
        },
      ]);

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await actionCustomization.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        true,
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });

    it.each([false, undefined])(
      'should not register the webhook when the feature is disabled (%s)',
      async optionValue => {
        const options = forestAdminHttpDriverOptions.build();

        const actionCustomization = new ActionCustomizationService(options);

        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'webhook',
            scope: 'Global',
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

        await actionCustomization.addWebhookActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          optionValue,
        );

        expect(collection.addAction).not.toHaveBeenCalled();
      },
    );
  });

  describe('static addWebhookActions', () => {
    it.each(['Global', 'Single', 'Bulk'] as ActionScope[])(
      'should register a webhook action with the scope $scope',
      async scope => {
        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'webhook',
            scope,
            url: 'https://my-url.com',
          },
        };

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        await ActionCustomizationService.addWebhookActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          [action],
        );

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope,
          execute: expect.any(Function),
        });
        expect(customizer.getCollection).toHaveBeenCalledWith('myModel');
      },
    );

    it('should execute the webhook', async () => {
      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myModel',
        configuration: {
          type: 'webhook',
          scope: 'Global',
          url: 'https://my-url.com',
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await ActionCustomizationService.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      const { execute } = collection.addAction.mock.calls[0][1];

      const context = { getRecords: jest.fn() } as unknown as ActionContext;

      await execute(context);

      expect(executeWebhookMock).toHaveBeenCalledWith(action, context);
    });

    it('should not use customizations that are not actions', async () => {
      const configuration = [
        {
          name: 'myAction',
          type: 'field' as ModelCustomizationType,
          modelName: 'myModel',
          configuration: {
            type: 'webhook',
            scope: 'Global',
            url: 'https://my-url.com',
          },
        },
      ];

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await ActionCustomizationService.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        configuration,
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });

    it('should not use actions that are not webhooks', async () => {
      const configuration = [
        {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'other' as ActionType,
            scope: 'Global',
            url: 'https://my-url.com',
          },
        },
      ];

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      await ActionCustomizationService.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        configuration,
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });
  });
});
