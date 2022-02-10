import { Factory } from 'fishery';
import { ForestAdminHttpDriverServices } from '../../src/services';
import factorySerializer from './serializer';
import factoryScope from './scope';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  scope: factoryScope.build(),
}));
