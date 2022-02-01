import { ForestAdminHttpDriverOptions } from '../types';
import ForestHttpApi from './forest-http-api';
import Scope from './scope';
import Serializer from './serializer';

type Options = Pick<
  ForestAdminHttpDriverOptions,
  'forestServerUrl' | 'envSecret' | 'logger' | 'prefix' | 'scopesCacheDurationInSeconds'
>;

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  forestHTTPApi: ForestHttpApi;
  scope: Scope;
};

export default ({
  prefix,
  forestServerUrl,
  envSecret,
  scopesCacheDurationInSeconds,
}: Options): ForestAdminHttpDriverServices => ({
  forestHTTPApi: new ForestHttpApi(forestServerUrl, envSecret),
  serializer: new Serializer(prefix),
  scope: new Scope(forestServerUrl, envSecret, scopesCacheDurationInSeconds),
});
