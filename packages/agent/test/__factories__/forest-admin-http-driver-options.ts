import { Factory } from 'fishery';
import { ForestAdminHttpDriverOptions } from '../../src/types';

export default Factory.define<ForestAdminHttpDriverOptions>(() => ({
  prefix: 'prefix',
}));
