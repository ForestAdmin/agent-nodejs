import { AgentOptionsWithDefaults } from '../types';
import ActionPermissionService from './permissions/action-permission';
import AuthorizationService from './authorization';
import PermissionService from './permissions/permissions';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  permissions: PermissionService;
  serializer: Serializer;
  authorization: AuthorizationService;
};

export default (options: AgentOptionsWithDefaults): ForestAdminHttpDriverServices => {
  const actionPermissionService = new ActionPermissionService(options);

  return {
    permissions: new PermissionService(options),
    authorization: new AuthorizationService(actionPermissionService),
    serializer: new Serializer(),
  };
};
