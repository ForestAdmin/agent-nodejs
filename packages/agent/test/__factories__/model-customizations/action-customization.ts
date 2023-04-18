import { Factory } from 'fishery';

import ActionCustomizationService from '../../../src/services/model-customizations/action-customization';
import forestAdminHttpDriverOptions from '../forest-admin-http-driver-options';

export class ActionCustomizationFactory extends Factory<ActionCustomizationService> {
  mockAllMethods() {
    return this.afterBuild(ActionCustomization => {
      ActionCustomization.addWebhookActions = jest.fn();
    });
  }
}

const actionCustomizationFactory = ActionCustomizationFactory.define(
  () => new ActionCustomizationService(forestAdminHttpDriverOptions.build()),
);

export default actionCustomizationFactory;
