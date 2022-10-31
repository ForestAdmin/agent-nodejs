import { Factory } from 'fishery';

import ForestAdminClient from '../../src/forest-admin-client-with-cache';
import chartHandlerFactory from './chart/chart-handler';
import contextVariablesInstantiatorFactory from './utils/context-variables-instantiator';
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
      contextVariablesInstantiatorFactory.build(),
      chartHandlerFactory.build(),
    ),
);

export default forestAdminClientFactory;
