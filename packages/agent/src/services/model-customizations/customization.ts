import { Plugin } from '@forestadmin/datasource-customizer';
import { ForestAdminClient, ModelCustomization } from '@forestadmin/forestadmin-client';

import ActionCustomizationService from './action-customization';
import { AgentOptionsWithDefaults } from '../../types';

export default class CustomizationService {
  private readonly client: ForestAdminClient;

  public constructor(agentOptions: Pick<AgentOptionsWithDefaults, 'forestAdminClient'>) {
    this.client = agentOptions.forestAdminClient;
  }

  public addCustomizations: Plugin<Pick<AgentOptionsWithDefaults, 'experimental'> | undefined> =
    async (datasourceCustomizer, _, options) => {
      if (!options?.experimental) return;

      const modelCustomizations = await this.client.modelCustomizationService.getConfiguration();

      if (options?.experimental.webhookCustomActions) {
        await ActionCustomizationService.addWebhookActions(
          datasourceCustomizer,
          _,
          modelCustomizations,
        );
      }

      if (options?.experimental.webhookCustomActions) {
        await ActionCustomizationService.addUpdateRecord(
          datasourceCustomizer,
          _,
          modelCustomizations,
        );
      }
    };

  public static addCustomizations: Plugin<ModelCustomization[]> = async (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    await ActionCustomizationService.addWebhookActions(
      datasourceCustomizer,
      _,
      modelCustomizations,
    );

    await ActionCustomizationService.addUpdateRecord(datasourceCustomizer, _, modelCustomizations);
  };

  public static getFeatures() {
    return [ActionCustomizationService.FEATURE];
  }
}
