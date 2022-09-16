import { AgentOptionsWithDefaults } from '../../types';
import ActionPermissionService from './internal/action-permission';
import AuthorizationService from './authorization';

export default function authorizationServiceFactory(
  options: AgentOptionsWithDefaults,
): AuthorizationService {
  const actionPermissionService = new ActionPermissionService(options);

  return new AuthorizationService(actionPermissionService);
}
