import {
  ActionScope,
  ModelCustomization,
  ModelCustomizationService,
  WebhookActionConfigurationApi,
} from './types';
import { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

function mapApiValues<T>(modelCustomization: ModelCustomization<T>): ModelCustomization<T> {
  if (modelCustomization.type !== 'action') {
    throw new Error('Only action customizations are supported for now.');
  }

  const configuration = modelCustomization.configuration as WebhookActionConfigurationApi;
  const mappedConfiguration = {
    ...configuration,
    scope: configuration.scope
      ? ((configuration.scope.slice(0, 1).toUpperCase() +
          configuration.scope.slice(1)) as ActionScope)
      : 'Single',
  };

  return {
    ...modelCustomization,
    configuration: mappedConfiguration as T,
  };
}

export default class ModelCustomizationFromApiService implements ModelCustomizationService {
  constructor(
    private readonly forestadminServerInterface: ForestAdminServerInterface,
    private readonly options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<ModelCustomization[]> {
    const result = await this.forestadminServerInterface.getModelCustomizations(this.options);

    return result.map(mapApiValues);
  }
}
