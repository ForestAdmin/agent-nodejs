import { Factory } from 'fishery';

import ModelCustomizationWithCacheService from '../../../src/model-customizations/model-customization-with-cache';
import forestAdminClientOptionsFactory from '../forest-admin-client-options';

export class ModelCustomizationServiceFactory extends Factory<ModelCustomizationWithCacheService> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.getConfiguration = jest.fn();
    });
  }
}

const modelCustomizationServiceFactory = ModelCustomizationServiceFactory.define(
  () => new ModelCustomizationWithCacheService(forestAdminClientOptionsFactory.build()),
);

export default modelCustomizationServiceFactory;
