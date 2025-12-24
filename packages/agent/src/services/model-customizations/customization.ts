import { Plugin } from '@forestadmin/datasource-customizer';
import { ForestAdminClient, ModelCustomization } from '@forestadmin/forestadmin-client';

import { AgentOptionsWithDefaults } from '../../types';
import UpdateRecordActionsPlugin from './actions/update-record/update-record-plugin';
import WebhookActionsPlugin from './actions/webhook/webhook-plugin';

type ExperimentalOptions = AgentOptionsWithDefaults['experimental'];

const optionsToFeatureMapping: Record<keyof ExperimentalOptions, string> = {
  webhookCustomActions: WebhookActionsPlugin.FEATURE,
  updateRecordCustomActions: UpdateRecordActionsPlugin.FEATURE,
};

const featuresFormattedWithVersion = [
  { feature: WebhookActionsPlugin.FEATURE, version: WebhookActionsPlugin.VERSION },
  { feature: UpdateRecordActionsPlugin.FEATURE, version: UpdateRecordActionsPlugin.VERSION },
];

export default class CustomizationPluginService {
  private readonly client: ForestAdminClient;

  private readonly options: AgentOptionsWithDefaults;

  public constructor(agentOptions: AgentOptionsWithDefaults) {
    this.client = agentOptions.forestAdminClient;

    this.options = agentOptions;
  }

  public addCustomizations: Plugin<void> = async (datasourceCustomizer, _) => {
    const { experimental } = this.options;
    if (!experimental) return;

    const modelCustomizations = await this.client.modelCustomizationService.getConfiguration();

    CustomizationPluginService.makeAddCustomizations(experimental)(
      datasourceCustomizer,
      _,
      modelCustomizations,
    );
  };

  public static makeAddCustomizations: (
    experimental: ExperimentalOptions,
  ) => Plugin<ModelCustomization[]> = (experimental: ExperimentalOptions) => {
    return (datasourceCustomizer, _, modelCustomizations) => {
      if (experimental.webhookCustomActions) {
        WebhookActionsPlugin.addWebhookActions(datasourceCustomizer, _, modelCustomizations);
      }

      if (experimental.updateRecordCustomActions) {
        UpdateRecordActionsPlugin.addUpdateRecordActions(
          datasourceCustomizer,
          _,
          modelCustomizations,
        );
      }
    };
  };

  public buildFeatures() {
    return CustomizationPluginService.buildFeatures(this.options?.experimental);
  }

  public static buildFeatures(experimental: ExperimentalOptions): Record<string, string> | null {
    const features = CustomizationPluginService.getFeatures(experimental);

    const enabledFeaturesFormattedWithVersion = featuresFormattedWithVersion
      .filter(({ feature }) => features?.includes(feature))
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

  private static getFeatures(experimental: ExperimentalOptions): string[] {
    return Object.entries(optionsToFeatureMapping)
      .filter(([experimentalFeature]) => experimental?.[experimentalFeature])
      .map(([, feature]) => feature);
  }
}
