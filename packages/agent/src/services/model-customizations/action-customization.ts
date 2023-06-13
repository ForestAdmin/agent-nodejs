import { Plugin } from '@forestadmin/datasource-customizer';
import {
  ActionConfiguration,
  ActionType,
  ForestAdminClient,
  ModelCustomization,
  ModelCustomizationType,
  UpdateRecordActionConfiguration,
  WebhookActionConfiguration,
} from '@forestadmin/forestadmin-client';

import executeWebhook from './execute-webhook';
import { AgentOptionsWithDefaults } from '../../types';

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

export default class ActionCustomizationService {
  public static VERSION = '1.0.0';
  public static FEATURE = 'webhook-custom-actions';

  private readonly client: ForestAdminClient;

  public constructor(agentOptions: Pick<AgentOptionsWithDefaults, 'forestAdminClient'>) {
    this.client = agentOptions.forestAdminClient;
  }

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

    return Promise.resolve();
  };

  public static addUpdateRecord: Plugin<ModelCustomization[]> = (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    const actions = getActions<UpdateRecordActionConfiguration>(
      'update-record',
      modelCustomizations,
    );
    actions.forEach(action => {
      const collection = datasourceCustomizer.getCollection(action.modelName);

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: async context => {
          const {
            configuration: {
              configuration: { fields },
            },
          } = action;

          await context.collection.update(context.filter, fields);
        },
      });
    });

    return Promise.resolve();
  };
}
