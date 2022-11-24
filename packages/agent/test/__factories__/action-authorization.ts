import { Factory } from 'fishery';

import ActionAuthorizationService from '../../src/routes/modification/action/action-authorization';
import forestAdminClientFactory from './forest-admin-client';

export class ActionAuthorizationsFactory extends Factory<ActionAuthorizationService> {
  mockAllMethods() {
    return this.afterBuild(service => {
      service.assertCanTriggerCustomAction = jest.fn().mockImplementation(() => Promise.resolve());
      service.assertCanApproveCustomAction = jest.fn().mockImplementation(() => Promise.resolve());
      service.assertCanRequestCustomActionParameters = jest
        .fn()
        .mockImplementation(() => Promise.resolve());
    });
  }
}

const actionAuthorizationServiceFactory = ActionAuthorizationsFactory.define(
  () => new ActionAuthorizationService(forestAdminClientFactory.build()),
);

export default actionAuthorizationServiceFactory;
