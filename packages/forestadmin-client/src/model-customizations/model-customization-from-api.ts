import {
  ActionScope,
  ModelCustomization,
  ModelCustomizationService,
  WebhookAction,
  WebhookActionConfiguration,
  WebhookActionConfigurationApi,
} from './types';
import { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

function mapApiValues(
  modelCustomization: ModelCustomization<WebhookActionConfigurationApi>,
): ModelCustomization<WebhookActionConfiguration> {
  if (modelCustomization.type !== 'action') {
    throw new Error('Only action customizations are supported for now.');
  }

  const configuration = modelCustomization.configuration as WebhookActionConfigurationApi;
  const mappedConfiguration: WebhookActionConfiguration = {
    ...configuration,
    scope: configuration.scope
      ? ((configuration.scope.slice(0, 1).toUpperCase() +
          configuration.scope.slice(1)) as ActionScope)
      : 'Single',
  };

  return {
    ...modelCustomization,
    configuration: mappedConfiguration,
  };
}

export default class ModelCustomizationFromApiService implements ModelCustomizationService {
  constructor(
    private readonly forestadminServerInterface: ForestAdminServerInterface,
    private readonly options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<WebhookAction[]> {
    const result = await this.forestadminServerInterface.getModelCustomizations(this.options);

    return result.map(mapApiValues);
  }
}
