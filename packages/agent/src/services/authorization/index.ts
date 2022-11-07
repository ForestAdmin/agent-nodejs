import { AgentOptionsWithDefaults } from '../../types';
import AuthorizationService from './authorization';

export default function authorizationServiceFactory(
  options: AgentOptionsWithDefaults,
): AuthorizationService {
  return new AuthorizationService(options.forestAdminClient);
}
