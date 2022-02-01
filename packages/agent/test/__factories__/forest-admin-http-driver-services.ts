import { Factory } from 'fishery';
import factorySerializer from './serializer';
import factoryForestHttpApi from './forest-http-api';
import factoryScope from './scope';
import { ForestAdminHttpDriverServices } from '../../dist/services';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  forestHTTPApi: factoryForestHttpApi.build(),
  scope: factoryScope.build(),
}));
