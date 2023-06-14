import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { ModelCustomizationType } from '@forestadmin/forestadmin-client/src/model-customizations/types';

import UpdateRecordActionsPlugin from '../../../src/services/model-customizations/actions/update-record/update-record-plugin';
import WebhookActionsPlugin from '../../../src/services/model-customizations/actions/webhook/webhook-plugin';
import CustomizationPluginService from '../../../src/services/model-customizations/customization';
import { forestAdminHttpDriverOptions } from '../../__factories__';
import dataSourceCustomizerFactory from '../../__factories__/datasource-customizer';

describe('Services > ModelCustomizations > CustomizationPluginService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addCustomizations', () => {
    const webhookAction = {
      name: 'myWebhookAction',
      type: ModelCustomizationType.action,
      modelName: 'myModel',
      configuration: {
        type: 'webhook',
        scope: 'Global',
        configuration: {
          url: 'https://my-url.com',
        },
      },
    };

    const updateRecordAction = {
      name: 'myUpdateRecordAction',
      type: ModelCustomizationType.action,
      modelName: 'myModel',
      configuration: {
        type: 'update-record',
        configuration: {
          fields: { field: 'value' },
        },
      },
    };

    describe('when experimental.webhookCustomActions is define', () => {
      it('should add all webhook action customizations', async () => {
        const options = forestAdminHttpDriverOptions.build();

        options.experimental.webhookCustomActions = true;

        const actionCustomization = new CustomizationPluginService(options);

        (
          options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
        ).mockResolvedValue([webhookAction, updateRecordAction]);

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn().mockReturnThis(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        await actionCustomization.addCustomizations(
          customizer,
          undefined as unknown as CollectionCustomizer,
        );

        expect(collection.addAction).toHaveBeenCalledWith('myWebhookAction', expect.anything());
      });
    });

    describe('when experimental.updateRecordCustomActions is define', () => {
      it('should add all update record action customizations', async () => {
        const options = forestAdminHttpDriverOptions.build();

        options.experimental.updateRecordCustomActions = true;

        const actionCustomization = new CustomizationPluginService(options);

        (
          options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
        ).mockResolvedValue([webhookAction, updateRecordAction]);

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        await actionCustomization.addCustomizations(
          customizer,
          undefined as unknown as CollectionCustomizer,
        );

        expect(collection.addAction).toHaveBeenCalledWith(
          'myUpdateRecordAction',
          expect.anything(),
        );
      });
    });

    it.each([false, undefined])(
      'should not add customizations when the feature is disabled (using %s)',
      async optionValue => {
        const options = forestAdminHttpDriverOptions.build();

        options.experimental.webhookCustomActions = optionValue;
        options.experimental.updateRecordCustomActions = optionValue;

        const actionCustomization = new CustomizationPluginService(options);

        (
          options.forestAdminClient.modelCustomizationService.getConfiguration as jest.Mock
        ).mockResolvedValue([webhookAction, updateRecordAction]);

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        await actionCustomization.addCustomizations(
          customizer,
          undefined as unknown as CollectionCustomizer,
        );

        expect(collection.addAction).not.toHaveBeenCalled();
      },
    );
  });

  describe('buildFeatures', () => {
    it(
      'should return all feature activated (using options.experimental) ' +
        'with their name and their version',
      async () => {
        const options = forestAdminHttpDriverOptions.build();

        options.experimental.webhookCustomActions = true;
        options.experimental.updateRecordCustomActions = true;

        const actionCustomization = new CustomizationPluginService(options);

        const features = actionCustomization.buildFeatures();

        expect(features).toStrictEqual({
          [WebhookActionsPlugin.FEATURE]: WebhookActionsPlugin.VERSION,
          [UpdateRecordActionsPlugin.FEATURE]: UpdateRecordActionsPlugin.VERSION,
        });
      },
    );

    it('should return null when nothing is activated (using options.experimental)', async () => {
      const options = forestAdminHttpDriverOptions.build();

      const actionCustomization = new CustomizationPluginService(options);

      const features = actionCustomization.buildFeatures();

      expect(features).toBeNull();
    });
  });
});
