import { Factory } from 'fishery';

import ForestAdminClient from '../../src/forest-admin-client-with-cache';
import forestAdminClientOptionsFactory from './forest-admin-client-options';
import permissionServiceFactory from './permissions/permission';
import renderingPermissionsFactory from './permissions/rendering-permission';

export class ForestAdminClientFactory extends Factory<ForestAdminClient> {
  mockAllMethods() {
    return this.afterBuild(client => {
      client.getScope = jest.fn();
      client.markScopesAsUpdated = jest.fn();
      client.verifySignedActionParameters = jest.fn();
    });
  }
}

const forestAdminClientFactory = ForestAdminClientFactory.define(
  () =>
    new ForestAdminClient(
      forestAdminClientOptionsFactory.build(),
      permissionServiceFactory.build(),
      renderingPermissionsFactory.build(),
    ),
);

export default forestAdminClientFactory;
