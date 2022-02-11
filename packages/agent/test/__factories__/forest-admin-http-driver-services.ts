import { Factory } from 'fishery';
import { ForestAdminHttpDriverServices } from '../../src/services';
import factoryScope from './scope';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  scope: factoryScope.mockAllMethods().build(),
}));
