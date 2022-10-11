import { ForestAdminClientOptions, ForestAdminClientOptionsWithDefaults } from './types';
import ActionPermissionService from './permissions/action-permission';
import ForestAdminClient from './forest-admin-client-with-cache';
import RenderingPermissionService from './permissions/rendering-permission';
import UserPermissionService from './permissions/user-permission';

export { ForestAdminClientOptions, Logger, LoggerLevel, ForestAdminClient } from './types';
export {
  SmartActionRequestBody,
  SmartActionApprovalRequestBody,
  CollectionActionEvent,
} from './permissions/types';
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

  return new ForestAdminClient(
    optionsWithDefaults,
    new ActionPermissionService(optionsWithDefaults),
    new RenderingPermissionService(
      optionsWithDefaults,
      new UserPermissionService(optionsWithDefaults),
    ),
  );
}
