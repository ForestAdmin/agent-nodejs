import { Factory } from 'fishery';
import factorySerializer from './serializer';
import factoryForestHttpApi from './forest-http-api';
import { ForestAdminHttpDriverServices } from '../../src/types';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  forestHTTPApi: factoryForestHttpApi.build(),
}));
