import AuthService from './auth';
import ChartHandler from './charts/chart-handler';
import EventsSubscriptionService from './events-subscription';
import NativeRefreshEventsHandlerService from './events-subscription/native-refresh-events-handler-service';
import IpWhiteListService from './ip-whitelist';
import ActionPermissionService from './permissions/action-permission';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';
import SchemaService from './schema';
import {
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
} from './types';
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
  auth: AuthService;
  eventsSubscription: EventsSubscriptionService;
} {
  const optionsWithDefaults = {
    forestServerUrl: 'https://api.forestadmin.com',
    permissionsCacheDurationInSeconds: 15 * 60,
    logger: defaultLogger,
    useServerEvents: true,
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
    chartHandler: new ChartHandler(contextVariables),
    ipWhitelist: new IpWhiteListService(optionsWithDefaults),
    schema: new SchemaService(optionsWithDefaults),
    auth: new AuthService(optionsWithDefaults),
  };
}
