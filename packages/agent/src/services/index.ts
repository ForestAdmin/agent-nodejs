import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import ScopeService from './scope';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  scope: ScopeService;
  serializer: Serializer;
};

export default (
  options: ForestAdminHttpDriverOptionsWithDefaults,
): ForestAdminHttpDriverServices => ({
  scope: new ScopeService(options),
  serializer: new Serializer(options),
});
