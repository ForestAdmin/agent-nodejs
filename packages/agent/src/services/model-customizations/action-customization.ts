import { DataSourceCustomizer, TSchema } from '@forestadmin/datasource-customizer';
import {
  ActionConfiguration,
  ActionType,
  ForestAdminClient,
  ModelCustomization,
  ModelCustomizationType,
  WebhookActionConfiguration,
} from '@forestadmin/forestadmin-client';

import executeWebhook from './execute-webhook';
import { AgentOptionsWithDefaults } from '../../types';

export default class ActionCustomizationService<S extends TSchema = TSchema> {
  public static VERSION = '1.0.0';

  private readonly client: ForestAdminClient;

  public constructor(agentOptions: AgentOptionsWithDefaults) {
    this.client = agentOptions.forestAdminClient;
  }

  public async addWebhookActions(customizer: DataSourceCustomizer<S>) {
    const actions = await this.getActions<WebhookActionConfiguration>('webhook');

    actions.forEach(action => {
      const collection = customizer.getCollection(action.modelName as Extract<keyof S, string>);

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: context =>
          executeWebhook({
            name: action.name,
            url: action.configuration.url,
            scope: action.configuration.scope,
            collection,
            context,
          }),
      });
    });
  }

  private async getActions<TConfiguration>(
    type: ActionType,
  ): Promise<ModelCustomization<TConfiguration>[]> {
    const configuration = await this.client.modelCustomizationService.getConfiguration();

    return configuration.filter(
      customization =>
        customization.type === ModelCustomizationType.action &&
        (customization as ModelCustomization<ActionConfiguration>).configuration.type === type,
    ) as ModelCustomization<TConfiguration>[];
  }
}
