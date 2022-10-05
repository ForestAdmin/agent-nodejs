import { Factory } from 'fishery';

import ForestAdminClient from '../../src/forest-admin-client';
import actionPermissionsFactory from './permissions/action-permission';
import forestAdminClientOptionsFactory from './forest-admin-client-options';
import renderingPermissionsFactory from './permissions/rendering-permission';

export class ForestAdminClientFactory extends Factory<ForestAdminClient> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.canOnCollection = jest.fn();
      client.canExecuteCustomAction = jest.fn();
      client.canExecuteCustomActionHook = jest.fn();
      client.getScope = jest.fn();
      client.markScopesAsUpdated = jest.fn();
    });
  }
}

const forestAdminClientFactory = ForestAdminClientFactory.define(
  () =>
    new ForestAdminClient(
      forestAdminClientOptionsFactory.build(),
      actionPermissionsFactory.build(),
      renderingPermissionsFactory.build(),
    ),
);

export default forestAdminClientFactory;
