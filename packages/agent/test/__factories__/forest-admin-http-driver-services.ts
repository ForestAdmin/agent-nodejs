import { Factory } from 'fishery';
import factorySerializer from './serializer';
import { ForestAdminHttpDriverServices } from '../../src/types';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
}));
