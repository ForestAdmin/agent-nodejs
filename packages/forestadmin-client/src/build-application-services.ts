import type { RefreshEventsHandlerService } from './events-subscription/types';
import type { McpServerConfigService } from './mcp-server-config';
import type { ModelCustomizationService } from './model-customizations/types';
import type {
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
} from './types';

import ActivityLogsService from './activity-logs';
import ChartHandler from './charts/chart-handler';
import EventsSubscriptionService from './events-subscription';
import NativeRefreshEventsHandlerService from './events-subscription/native-refresh-events-handler-service';
import IpWhiteListService from './ip-whitelist';
import McpServerConfigFromApiService from './mcp-server-config';
import ModelCustomizationFromApiService from './model-customizations/model-customization-from-api';
import ActionPermissionService from './permissions/action-permission';
import ForestHttpApi from './permissions/forest-http-api';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';
import SchemaService from './schema';
import ContextVariablesInstantiator from './utils/context-variables-instantiator';
import defaultLogger from './utils/default-logger';

/**
 * Merges a partial server interface with the default ForestHttpApi implementation.
 * This allows consumers to override only the methods they need while falling back
 * to the default HTTP implementation for the rest.
 */
function withDefaultImplementation(
  customInterface: Partial<ForestAdminServerInterface>,
): ForestAdminServerInterface {
  const defaultImplementation = new ForestHttpApi();

  return new Proxy(customInterface, {
    get(target, prop: string | symbol) {
      // Handle Symbol properties (e.g., Symbol.toStringTag, Symbol.iterator)
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop);
      }

      const customMethod = target[prop as keyof ForestAdminServerInterface];

      // Use custom implementation if provided
      if (customMethod !== undefined) {
        return typeof customMethod === 'function' ? customMethod.bind(target) : customMethod;
      }

      // Fallback to default implementation
      const defaultMethod = defaultImplementation[prop as keyof ForestAdminServerInterface];

      return typeof defaultMethod === 'function'
        ? defaultMethod.bind(defaultImplementation)
        : defaultMethod;
    },
  }) as ForestAdminServerInterface;
}

export default function buildApplicationServices(
  forestAdminServerInterface: Partial<ForestAdminServerInterface>,
  options: ForestAdminClientOptions,
): {
  optionsWithDefaults: ForestAdminClientOptionsWithDefaults;
  renderingPermission: RenderingPermissionService;
  schema: SchemaService;
  activityLogs: ActivityLogsService;
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

  // Merge custom interface with default implementation (ForestHttpApi)
  // This allows partial implementations to fallback to default HTTP calls
  const serverInterface = withDefaultImplementation(forestAdminServerInterface);

  const usersPermission = new UserPermissionService(optionsWithDefaults, serverInterface);

  const renderingPermission = new RenderingPermissionService(
    optionsWithDefaults,
    usersPermission,
    serverInterface,
  );

  const actionPermission = new ActionPermissionService(optionsWithDefaults, serverInterface);

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
    ipWhitelist: new IpWhiteListService(serverInterface, optionsWithDefaults),
    schema: new SchemaService(serverInterface, optionsWithDefaults),
    activityLogs: new ActivityLogsService(serverInterface, optionsWithDefaults),
    auth: serverInterface.makeAuthService(optionsWithDefaults),
    modelCustomizationService: new ModelCustomizationFromApiService(
      serverInterface,
      optionsWithDefaults,
    ),
    mcpServerConfigService: new McpServerConfigFromApiService(serverInterface, optionsWithDefaults),
  };
}
