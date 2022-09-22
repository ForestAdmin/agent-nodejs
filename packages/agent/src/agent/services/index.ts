import { AgentOptionsWithDefaults } from '../types';
import AuthorizationService from './authorization/authorization';
import Serializer from './serializer';
import authorizationServiceFactory from './authorization';

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  authorization: AuthorizationService;
};

export default (options: AgentOptionsWithDefaults): ForestAdminHttpDriverServices => {
  return {
    authorization: authorizationServiceFactory(options),
    serializer: new Serializer(),
  };
};
