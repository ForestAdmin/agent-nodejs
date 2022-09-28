import { AgentOptionsWithDefaults } from '../../types';
import ActionPermissionService from './internal/action-permission';
import AuthorizationService from './authorization';
import RenderingPermissionService from './internal/rendering-permission';
import UserPermissionService from './internal/user-permission';

export default function authorizationServiceFactory(
  options: AgentOptionsWithDefaults,
): AuthorizationService {
  const actionPermissionService = new ActionPermissionService(options);
  const userPermissionService = new UserPermissionService(options);
  const renderingPermissionService = new RenderingPermissionService(options, userPermissionService);

  return new AuthorizationService(actionPermissionService, renderingPermissionService);
}

export { CustomActionEvent, EnvironmentPermissionsV4, UserPermissionV4 } from './internal/types';
