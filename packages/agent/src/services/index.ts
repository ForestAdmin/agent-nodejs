import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import ForestHttpApi from './forest-http-api';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  forestHTTPApi: ForestHttpApi;
};

export default (
  options: ForestAdminHttpDriverOptionsWithDefaults,
): ForestAdminHttpDriverServices => ({
  forestHTTPApi: new ForestHttpApi(options),
  serializer: new Serializer(options),
});
