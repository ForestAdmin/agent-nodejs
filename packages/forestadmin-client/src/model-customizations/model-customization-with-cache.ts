import { ModelCustomization, ModelCustomizationService } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

export default class ModelCustomizationWithCacheService implements ModelCustomizationService {
  private configuration: Promise<ModelCustomization<unknown>[]>;

  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

  async getConfiguration(): Promise<ModelCustomization<unknown>[]> {
    if (!this.configuration) {
      this.configuration = this.fetchConfiguration();
    }

    return this.configuration;
  }

  private async fetchConfiguration(): Promise<ModelCustomization<unknown>[]> {
    return ServerUtils.query(this.options, 'get', '/liana/model-customizations');
  }
}
