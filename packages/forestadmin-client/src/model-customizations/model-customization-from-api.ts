import { ModelCustomization, ModelCustomizationService } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

export default class ModelCustomizationFromApiService implements ModelCustomizationService {
  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

  async getConfiguration(): Promise<ModelCustomization<unknown>[]> {
    return ServerUtils.query(this.options, 'get', '/liana/model-customizations');
  }
}
