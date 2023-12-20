import { Plugin } from '@forestadmin/datasource-customizer';
import { ModelCustomization, WebhookActionConfiguration } from '@forestadmin/forestadmin-client';

import executeWebhook from './execute-webhook';
import getActions from '../get-actions';

export default class WebhookActionsPlugin {
  public static VERSION = '1.0.0';
  public static FEATURE = 'webhook-custom-actions';

  public static addWebhookActions: Plugin<ModelCustomization[]> = (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    const actions = getActions<WebhookActionConfiguration>('webhook', modelCustomizations);
    actions.forEach(action => {
      const collection = datasourceCustomizer.collections.find(c => c.name === action.modelName);
      if (!collection) return;

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: context => executeWebhook(action, context),
      });
    });
  };
}
