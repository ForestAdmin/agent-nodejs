import ChartHandler from './charts/chart-handler';
import EventsSubscriptionService from './events-subscription';
import NativeRefreshEventsHandlerService from './events-subscription/native-refresh-events-handler-service';
import NotifyFrontendService from './events-subscription/notify-frontend-service';
import { RefreshEventsHandlerService } from './events-subscription/types';
import IpWhiteListService from './ip-whitelist';
import ModelCustomizationFromApiService from './model-customizations/model-customization-from-api';
import { ModelCustomizationService } from './model-customizations/types';
import ActionPermissionService from './permissions/action-permission';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';
import SchemaService from './schema';
import {
  ForestAdminAuthServiceInterface,
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
  auth: ForestAdminAuthServiceInterface;
  modelCustomizationService: ModelCustomizationService;
  eventsSubscription: EventsSubscriptionService;
  eventsHandler: RefreshEventsHandlerService;
  notifyFrontendService: NotifyFrontendService;
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

  const notifyFrontendService = new NotifyFrontendService(
    optionsWithDefaults,
    forestAdminServerInterface,
  );

  return {
    renderingPermission,
    optionsWithDefaults,
    permission,
    contextVariables,
    eventsSubscription,
    eventsHandler,
    notifyFrontendService,
    chartHandler: new ChartHandler(contextVariables),
    ipWhitelist: new IpWhiteListService(optionsWithDefaults),
    schema: new SchemaService(optionsWithDefaults),
    auth: forestAdminServerInterface.makeAuthService(optionsWithDefaults),
    modelCustomizationService: new ModelCustomizationFromApiService(
      forestAdminServerInterface,
      optionsWithDefaults,
    ),
  };
}
