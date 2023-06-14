import { Plugin } from '@forestadmin/datasource-customizer';
import {
  ActionConfiguration,
  ActionType,
  ModelCustomization,
  ModelCustomizationType,
  WebhookActionConfiguration,
} from '@forestadmin/forestadmin-client';

import executeWebhook from './execute-webhook';

function getActions<TConfiguration>(
  type: ActionType,
  configuration: ModelCustomization[],
): ModelCustomization<TConfiguration>[] {
  return configuration.filter(
    customization =>
      customization.type === ModelCustomizationType.action &&
      (customization as ModelCustomization<ActionConfiguration>).configuration.type === type,
  ) as ModelCustomization<TConfiguration>[];
}

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
      const collection = datasourceCustomizer.getCollection(action.modelName);

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: context => executeWebhook(action, context),
      });
    });
  };
}
