import AuthorizationService from './authorization';
import { AgentOptionsWithDefaults } from '../../types';

export default function authorizationServiceFactory(
  options: AgentOptionsWithDefaults,
): AuthorizationService {
  return new AuthorizationService(options.forestAdminClient);
}
