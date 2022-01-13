import { ForestAdminHttpDriverOptions } from '../types';
import ForestHttpApi from './forest-http-api';
import Serializer from './serializer';

type Options = Pick<
  ForestAdminHttpDriverOptions,
  'forestServerUrl' | 'envSecret' | 'logger' | 'prefix'
>;

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  forestHTTPApi: ForestHttpApi;
};

export default ({
  prefix,
  forestServerUrl,
  envSecret,
}: Options): ForestAdminHttpDriverServices => ({
  forestHTTPApi: new ForestHttpApi(forestServerUrl, envSecret),
  serializer: new Serializer(prefix),
});
