import { Factory } from 'fishery';

import CustomizationPluginService from '../../../src/services/model-customizations/customization';
import forestAdminHttpDriverOptions from '../forest-admin-http-driver-options';

export class CustomizationPluginServiceFactory extends Factory<CustomizationPluginService> {
  mockAllMethods() {
    return this.afterBuild(CustomizationPlugin => {
      CustomizationPlugin.addCustomizations = jest.fn();
      CustomizationPlugin.buildFeatures = jest.fn();
    });
  }
}

const customizationPluginServiceFactory = CustomizationPluginServiceFactory.define(
  () => new CustomizationPluginService(forestAdminHttpDriverOptions.build()),
);

export default customizationPluginServiceFactory;
