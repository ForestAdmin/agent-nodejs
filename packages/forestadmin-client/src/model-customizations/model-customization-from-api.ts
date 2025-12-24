import type {
  ActionConfigurationApi,
  ActionScope,
  ConfigurationApi,
  ModelCustomization,
  ModelCustomizationService,
} from './types';
import type { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

import { ModelCustomizationType } from './types';

function mapApiValues(
  modelCustomization: ModelCustomization<ConfigurationApi>,
): ModelCustomization {
  switch (modelCustomization.type) {
    case ModelCustomizationType.action: {
      const configuration = modelCustomization.configuration as ActionConfigurationApi;
      const mappedConfiguration = {
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

    default:
      throw new Error('Only action customizations are supported for now.');
  }
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
