import { DataSourceCustomizer, TSchema } from '@forestadmin/datasource-customizer';
import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionConfiguration,
  ActionType,
  ActionScope as ConfigurationScope,
  ForestAdminClient,
  ModelCustomization,
  ModelCustomizationType,
  WebhookActionConfiguration,
} from '@forestadmin/forestadmin-client';

import createWebhookExecutor from './webhook-executor';
import { AgentOptionsWithDefaults } from '../../types';

function translateScope(scope: `${ConfigurationScope}`): ActionScope {
  switch (scope) {
    case ConfigurationScope.global:
      return 'Global';
    case ConfigurationScope.bulk:
      return 'Bulk';
    case ConfigurationScope.single:
      return 'Single';
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

export default class ActionCustomizationService<S extends TSchema = TSchema> {
  public static VERSION = '1.0.0';

  private readonly client: ForestAdminClient;

  public constructor(agentOptions: AgentOptionsWithDefaults) {
    this.client = agentOptions.forestAdminClient;
  }

  public async addWebhookActions(customizer: DataSourceCustomizer<S>) {
    const actions = await this.getActions<WebhookActionConfiguration>(ActionType.webhook);

    actions.forEach(action => {
      const collection = customizer.getCollection(action.modelName as Extract<keyof S, string>);

      collection.addAction(action.name, {
        scope: translateScope(action.configuration.scope),
        execute: createWebhookExecutor(action),
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
