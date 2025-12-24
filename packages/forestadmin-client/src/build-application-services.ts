import type { RefreshEventsHandlerService } from './events-subscription/types';
import type { McpServerConfigService } from './mcp-server-config';
import type { ModelCustomizationService } from './model-customizations/types';
import type {
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
} from './types';

import ChartHandler from './charts/chart-handler';
import EventsSubscriptionService from './events-subscription';
import NativeRefreshEventsHandlerService from './events-subscription/native-refresh-events-handler-service';
import IpWhiteListService from './ip-whitelist';
import McpServerConfigFromApiService from './mcp-server-config';
import ModelCustomizationFromApiService from './model-customizations/model-customization-from-api';
import ActionPermissionService from './permissions/action-permission';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';
import SchemaService from './schema';
import ContextVariablesInstantiator from './utils/context-variables-instantiator';
import defaultLogger from './utils/default-logger';

export default function buildApplicationServices(
  forestAdminServerInterface: ForestAdminServerInterface,
  options: ForestAdminClientOptions,
): {
  optionsWithDefaults: ForestAdminClientOptionsWithDefaults;
  renderingPermission: RenderingPermissionService;
  schema: SchemaService;
  contextVariables: ContextVariablesInstantiator;
  ipWhitelist: IpWhiteListService;
  permission: PermissionService;
  chartHandler: ChartHandler;
  auth: ForestAdminAuthServiceInterface;
  modelCustomizationService: ModelCustomizationService;
  mcpServerConfigService: McpServerConfigService;
  eventsSubscription: EventsSubscriptionService;
  eventsHandler: RefreshEventsHandlerService;
} {
  const optionsWithDefaults = {
    forestServerUrl: 'https://api.forestadmin.com',
    permissionsCacheDurationInSeconds: 15 * 60,
    logger: defaultLogger,
    instantCacheRefresh: true,
    experimental: null,
    ...options,
  };

  const usersPermission = new UserPermissionService(
    optionsWithDefaults,
    forestAdminServerInterface,
  );

  const renderingPermission = new RenderingPermissionService(
    optionsWithDefaults,
    usersPermission,
    forestAdminServerInterface,
  );

  const actionPermission = new ActionPermissionService(
    optionsWithDefaults,
    forestAdminServerInterface,
  );

  const contextVariables = new ContextVariablesInstantiator(renderingPermission);

  const permission = new PermissionService(actionPermission, renderingPermission);

  const eventsHandler = new NativeRefreshEventsHandlerService(
    actionPermission,
    usersPermission,
    renderingPermission,
  );

  const eventsSubscription = new EventsSubscriptionService(optionsWithDefaults, eventsHandler);

  return {
    renderingPermission,
    optionsWithDefaults,
    permission,
    contextVariables,
    eventsSubscription,
    eventsHandler,
    chartHandler: new ChartHandler(contextVariables),
    ipWhitelist: new IpWhiteListService(optionsWithDefaults),
    schema: new SchemaService(optionsWithDefaults),
    auth: forestAdminServerInterface.makeAuthService(optionsWithDefaults),
    modelCustomizationService: new ModelCustomizationFromApiService(
      forestAdminServerInterface,
      optionsWithDefaults,
    ),
    mcpServerConfigService: new McpServerConfigFromApiService(
      forestAdminServerInterface,
      optionsWithDefaults,
    ),
  };
}
