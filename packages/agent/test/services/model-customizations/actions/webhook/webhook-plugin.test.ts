import { ActionContext, CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionType,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';

import executeWebhook from '../../../../../src/services/model-customizations/actions/webhook/execute-webhook';
import WebhookActionsPlugin from '../../../../../src/services/model-customizations/actions/webhook/webhook-plugin';
import dataSourceCustomizerFactory from '../../../../__factories__/datasource-customizer';

jest.mock(
  '../../../../../src/services/model-customizations/actions/webhook/execute-webhook',
  () => ({
    __esModule: true,
    default: jest.fn(),
  }),
);

const executeWebhookMock = executeWebhook as jest.Mock;

describe('Services > ModelCustomizations > Actions > WebhookActionsPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('static addWebhookActions', () => {
    it.each(['Global', 'Single', 'Bulk'] as ActionScope[])(
      'should register a webhook action with the scope %s',
      scope => {
        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'webhook',
            scope,
            configuration: { url: 'https://my-url.com' },
          },
        };

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
          name: 'myModel',
        };

        jest
          .spyOn(customizer, 'findCollection')
          .mockReturnValue(collection as unknown as CollectionCustomizer);

        WebhookActionsPlugin.addWebhookActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          [action],
        );

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope,
          execute: expect.any(Function),
        });
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
          configuration: { url: 'https://my-url.com' },
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };

      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(collection as unknown as CollectionCustomizer);

      WebhookActionsPlugin.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      const { execute } = collection.addAction.mock.calls[0][1];

      const context = { getRecords: jest.fn() } as unknown as ActionContext;

      await execute(context);

      expect(executeWebhookMock).toHaveBeenCalledWith(action, context);
    });

    it('should do nothing if the collection is missing', async () => {
      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myOtherModel',
        configuration: {
          type: 'webhook',
          scope: 'Global',
          configuration: { fields: [{ fieldName: 'field', value: 'value' }] },
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };
      jest.spyOn(customizer, 'findCollection').mockReturnValue(undefined);

      WebhookActionsPlugin.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });

    it('should not use customizations that are not actions', async () => {
      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };

      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(collection as unknown as CollectionCustomizer);

      WebhookActionsPlugin.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [
          {
            name: 'myAction',
            type: 'field' as ModelCustomizationType,
            modelName: 'myModel',
            configuration: {
              type: 'webhook',
              scope: 'Global',
              configuration: { url: 'https://my-url.com' },
            },
          },
        ],
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });

    it('should not use actions that are not webhooks', async () => {
      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };

      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(collection as unknown as CollectionCustomizer);

      WebhookActionsPlugin.addWebhookActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [
          {
            name: 'myAction',
            type: ModelCustomizationType.action,
            modelName: 'myModel',
            configuration: {
              type: 'other' as ActionType,
              scope: 'Global',
              configuration: { other: 1 },
            },
          },
        ],
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });
  });
});
