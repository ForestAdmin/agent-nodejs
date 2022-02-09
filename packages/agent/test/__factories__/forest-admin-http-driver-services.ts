import { Factory } from 'fishery';
import { ForestAdminHttpDriverServices } from '../../src/services';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
}));
