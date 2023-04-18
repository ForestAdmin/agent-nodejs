import {
  ActionScope,
  ModelCustomization,
  ModelCustomizationService,
  WebhookActionConfiguration,
  WebhookActionConfigurationApi,
} from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

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
  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

  async getConfiguration(): Promise<ModelCustomization<WebhookActionConfiguration>[]> {
    const result = await ServerUtils.query<ModelCustomization<WebhookActionConfigurationApi>[]>(
      this.options,
      'get',
      '/liana/model-customizations',
    );

    return result.map(mapApiValues);
  }
}
