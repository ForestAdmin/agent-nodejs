import { AgentOptionsWithDefaults } from '../types';
import PermissionService from './permissions';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  permissions: PermissionService;
  serializer: Serializer;
};

export default (options: AgentOptionsWithDefaults): ForestAdminHttpDriverServices => ({
  permissions: new PermissionService(options),
  serializer: new Serializer(options),
});
