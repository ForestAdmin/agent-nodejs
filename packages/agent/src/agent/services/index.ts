import { AgentOptionsWithDefaults } from '../types';
import AuthorizationService from './authorization/authorization';
import PermissionService from './permissions';
import Serializer from './serializer';
import authorizationServiceFactory from './authorization';

export type ForestAdminHttpDriverServices = {
  permissions: PermissionService;
  serializer: Serializer;
  authorization: AuthorizationService;
};

export default (options: AgentOptionsWithDefaults): ForestAdminHttpDriverServices => {
  return {
    permissions: new PermissionService(options),
    authorization: authorizationServiceFactory(options),
    serializer: new Serializer(),
  };
};
