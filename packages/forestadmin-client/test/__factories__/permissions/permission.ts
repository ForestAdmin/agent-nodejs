import { Factory } from 'fishery';

import PermissionServiceWithCache from '../../../src/permissions/permission-with-cache';
import actionPermissionsFactory from './action-permission';
import renderingPermissionsFactory from './rendering-permission';

export class PermissionServiceFactory extends Factory<PermissionServiceWithCache> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.canOnCollection = jest.fn();
      client.canTriggerCustomAction = jest.fn();
      client.canApproveCustomAction = jest.fn();
      client.canRequestCustomActionParameters = jest.fn();
      client.canRetrieveChart = jest.fn();
    });
  }
}

const permissionServiceFactory = PermissionServiceFactory.define(
  () =>
    new PermissionServiceWithCache(
      actionPermissionsFactory.build(),
      renderingPermissionsFactory.build(),
    ),
);

export default permissionServiceFactory;
