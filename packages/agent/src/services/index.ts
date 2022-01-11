import { ForestAdminHttpDriverOptions } from '../types';
import ForestHttpApi from './forest-http-api';
import Serializer from './serializer';

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  forestHTTPApi: ForestHttpApi;
};

export default ({
  prefix,
  forestServerUrl,
  envSecret,
  logger,
}: ForestAdminHttpDriverOptions): ForestAdminHttpDriverServices => ({
  forestHTTPApi: new ForestHttpApi(forestServerUrl, envSecret, logger),
  serializer: new Serializer(prefix),
});
