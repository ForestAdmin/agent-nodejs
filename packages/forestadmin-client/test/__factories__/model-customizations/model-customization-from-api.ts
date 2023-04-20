import { Factory } from 'fishery';

import ModelCustomizationFromApiService from '../../../src/model-customizations/model-customization-from-api';
import forestAdminClientOptionsFactory from '../forest-admin-client-options';

export class ModelCustomizationServiceFactory extends Factory<ModelCustomizationFromApiService> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.getConfiguration = jest.fn();
    });
  }
}

const modelCustomizationServiceFactory = ModelCustomizationServiceFactory.define(
  () => new ModelCustomizationFromApiService(forestAdminClientOptionsFactory.build()),
);

export default modelCustomizationServiceFactory;
