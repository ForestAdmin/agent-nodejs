import { Plugin } from '@forestadmin/datasource-customizer';
import { ForestAdminClient, ModelCustomization } from '@forestadmin/forestadmin-client';

import UpdateRecordActionsPlugin from './actions/update-record/update-record-plugin';
import WebhookActionsPlugin from './actions/webhook/webhook-plugin';
import { AgentOptionsWithDefaults } from '../../types';

export default class CustomizationPluginService {
  private readonly client: ForestAdminClient;

  private readonly options: AgentOptionsWithDefaults;

  public constructor(agentOptions: AgentOptionsWithDefaults) {
    this.client = agentOptions.forestAdminClient;

    this.options = agentOptions;
  }

  public addCustomizations: Plugin<Pick<AgentOptionsWithDefaults, 'experimental'> | undefined> =
    async (datasourceCustomizer, _, options) => {
      if (!options?.experimental) return;

      const modelCustomizations = await this.client.modelCustomizationService.getConfiguration();

      if (options?.experimental.webhookCustomActions) {
        WebhookActionsPlugin.addWebhookActions(datasourceCustomizer, _, modelCustomizations);
      }

      if (options?.experimental.webhookCustomActions) {
        UpdateRecordActionsPlugin.addUpdateRecord(datasourceCustomizer, _, modelCustomizations);
      }
    };

  public getFeatures(): string[] | null {
    const mapping: Record<keyof AgentOptionsWithDefaults['experimental'], string> = {
      webhookCustomActions: WebhookActionsPlugin.FEATURE,
    };

    return Object.entries(mapping)
      .filter(([experimentalFeature]) => this.options.experimental?.[experimentalFeature])
      .map(([, feature]) => feature);
  }

  public buildFeatures(): Record<string, string> {
    return CustomizationPluginService.buildFeatures(this.getFeatures());
  }

  public static addCustomizations: Plugin<ModelCustomization[]> = (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    WebhookActionsPlugin.addWebhookActions(datasourceCustomizer, _, modelCustomizations);

    UpdateRecordActionsPlugin.addUpdateRecord(datasourceCustomizer, _, modelCustomizations);
  };

  public static getFeatures() {
    return [WebhookActionsPlugin.FEATURE, UpdateRecordActionsPlugin.FEATURE];
  }

  /**
   * By default all plugins are loaded
   */
  public static buildFeatures(
    features = CustomizationPluginService.getFeatures(),
  ): Record<string, string> {
    const enabledFeaturesFormattedWithVersion = [
      { feature: WebhookActionsPlugin.FEATURE, version: WebhookActionsPlugin.VERSION },
      { feature: UpdateRecordActionsPlugin.FEATURE, version: UpdateRecordActionsPlugin.VERSION },
    ]
      .filter(({ feature }) => features.includes(feature))
      .reduce(
        (acc, { feature, version }) => ({
          ...acc,
          [feature]: version,
        }),
        {},
      );

    return Object.keys(enabledFeaturesFormattedWithVersion).length
      ? enabledFeaturesFormattedWithVersion
      : null;
  }
}
