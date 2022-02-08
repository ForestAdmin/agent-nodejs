import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
};

export default (
  options: ForestAdminHttpDriverOptionsWithDefaults,
): ForestAdminHttpDriverServices => ({
  serializer: new Serializer(options),
});
