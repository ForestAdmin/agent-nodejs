import AuthService from './auth';
import ChartHandler from './charts/chart-handler';
import IpWhiteListService from './ip-whitelist';
import ActionPermissionService from './permissions/action-permission';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';
import SchemaService from './schema';
import {
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestServerRepository,
} from './types';
import ContextVariablesInstantiator from './utils/context-variables-instantiator';
import defaultLogger from './utils/default-logger';

export default function buildApplicationServices(
  forestServerRepository: ForestServerRepository,
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
} {
  const optionsWithDefaults = {
    forestServerUrl: 'https://api.forestadmin.com',
    permissionsCacheDurationInSeconds: 15 * 60,
    logger: defaultLogger,
    ...options,
  };

  const { getEnvironmentPermissions, getUsers, getRenderingPermissions } = forestServerRepository;

  const renderingPermission = new RenderingPermissionService(
    optionsWithDefaults,
    new UserPermissionService(optionsWithDefaults, getUsers),
    getRenderingPermissions,
  );
  const contextVariables = new ContextVariablesInstantiator(renderingPermission);

  const permission = new PermissionService(
    new ActionPermissionService(optionsWithDefaults, getEnvironmentPermissions),
    renderingPermission,
  );

  return {
    renderingPermission,
    optionsWithDefaults,
    permission,
    contextVariables,
    chartHandler: new ChartHandler(contextVariables),
    ipWhitelist: new IpWhiteListService(optionsWithDefaults),
    schema: new SchemaService(optionsWithDefaults),
    auth: new AuthService(optionsWithDefaults),
  };
}
