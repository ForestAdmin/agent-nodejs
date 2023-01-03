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
) {
  const optionsWithDefaults: ForestAdminClientOptionsWithDefaults = {
    forestServerUrl: 'https://api.forestadmin.com',
    permissionsCacheDurationInSeconds: 15 * 60,
    logger: defaultLogger,
    ...options,
  };

  const actionPermission = new ActionPermissionService(
    optionsWithDefaults,
    forestServerRepository.getEnvironmentPermissions,
  );
  const userPermission = new UserPermissionService(
    optionsWithDefaults,
    forestServerRepository.getUsers,
  );
  const renderingPermission = new RenderingPermissionService(
    optionsWithDefaults,
    userPermission,
    forestServerRepository.getRenderingPermissions,
  );
  const permissionService = new PermissionService(actionPermission, renderingPermission);
  const contextVariablesInstantiator = new ContextVariablesInstantiator(renderingPermission);
  const chartHandler = new ChartHandler(contextVariablesInstantiator);
  const ipWhitelistPermission = new IpWhiteListService(optionsWithDefaults);
  const schemaService = new SchemaService(optionsWithDefaults);
  const authService = new AuthService(optionsWithDefaults);

  return {
    optionsWithDefaults,
    permissionService,
    renderingPermission,
    contextVariablesInstantiator,
    chartHandler,
    ipWhitelistPermission,
    schemaService,
    authService,
  };
}
