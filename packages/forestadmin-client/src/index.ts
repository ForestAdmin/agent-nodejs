import { ForestAdminClientOptions, ForestAdminClientOptionsWithDefaults } from './types';
import ActionPermissionService from './permissions/action-permission';
import ForestAdminClient from './forest-admin-client-with-cache';
import PermissionService from './permissions/permission-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';

export { ForestAdminClientOptions, Logger, LoggerLevel, ForestAdminClient } from './types';
export { CollectionActionEvent } from './permissions/types';
export { Operator } from './permissions/operators';
export { default as JTWTokenExpiredError } from './permissions/errors/jwt-token-expired-error';
export { default as JTWUnableToVerifyError } from './permissions/errors/jwt-unable-to-verify-error';

export default function createForestAdminClient(
  options: ForestAdminClientOptions,
): ForestAdminClient {
  const optionsWithDefaults: ForestAdminClientOptionsWithDefaults = {
    forestServerUrl: 'https://api.forestadmin.com',
    permissionsCacheDurationInSeconds: 15 * 60,
    // eslint-disable-next-line no-console
    logger: (level, ...args) => console[level.toLowerCase()](...args),
    ...options,
  };

  const actionPermission = new ActionPermissionService(optionsWithDefaults);
  const userPermission = new UserPermissionService(optionsWithDefaults);
  const renderingPermission = new RenderingPermissionService(optionsWithDefaults, userPermission);
  const permissionService = new PermissionService(actionPermission, renderingPermission);

  return new ForestAdminClient(optionsWithDefaults, permissionService, renderingPermission);
}
