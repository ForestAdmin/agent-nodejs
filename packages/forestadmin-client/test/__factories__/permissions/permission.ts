import { Factory } from 'fishery';

import actionPermissionsFactory from './action-permission';
import renderingPermissionsFactory from './rendering-permission';
import PermissionServiceWithCache from '../../../src/permissions/permission-with-cache';

export class PermissionServiceFactory extends Factory<PermissionServiceWithCache> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.canOnCollection = jest.fn();
      client.canTriggerCustomAction = jest.fn();
      client.canApproveCustomAction = jest.fn();
      client.canRequestCustomActionParameters = jest.fn();
      client.canExecuteChart = jest.fn();
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
