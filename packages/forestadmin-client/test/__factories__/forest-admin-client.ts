import { Factory } from 'fishery';

import authServiceFactory from './auth';
import chartHandlerFactory from './chart/chart-handler';
import forestAdminClientOptionsFactory from './forest-admin-client-options';
import ipWhitelistServiceFactory from './ip-whitelist';
import modelCustomizationServiceFactory from './model-customizations/model-customization-from-api';
import permissionServiceFactory from './permissions/permission';
import renderingPermissionsFactory from './permissions/rendering-permission';
import schemaServiceFactory from './schema';
import contextVariablesInstantiatorFactory from './utils/context-variables-instantiator';
import ForestAdminClient from '../../src/forest-admin-client-with-cache';

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
      ipWhitelistServiceFactory.build(),
      schemaServiceFactory.build(),
      authServiceFactory.build(),
      modelCustomizationServiceFactory.build(),
    ),
);

export default forestAdminClientFactory;
