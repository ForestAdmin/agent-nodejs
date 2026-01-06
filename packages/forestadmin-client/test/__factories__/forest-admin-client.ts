import { Factory } from 'fishery';

import activityLogsServiceFactory from './activity-logs';
import authServiceFactory from './auth';
import chartHandlerFactory from './chart/chart-handler';
import eventsSubscriptionServiceFactory from './events-subscription';
import nativeRefreshEventsHandlerServiceFactory from './events-subscription/native-refresh-events-handler-service';
import forestAdminClientOptionsFactory from './forest-admin-client-options';
import ipWhitelistServiceFactory from './ip-whitelist';
import mcpServerConfigServiceFactory from './mcp-server-config';
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
      activityLogsServiceFactory.build(),
      authServiceFactory.build(),
      modelCustomizationServiceFactory.build(),
      mcpServerConfigServiceFactory.build(),
      eventsSubscriptionServiceFactory.build(),
      nativeRefreshEventsHandlerServiceFactory.build(),
    ),
);

export default forestAdminClientFactory;
