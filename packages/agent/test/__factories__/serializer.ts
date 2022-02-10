import { Factory } from 'fishery';

import Serializer from '../../src/services/serializer';

export default Factory.define<Serializer>(() => new Serializer({ prefix: '/prefix' }));
