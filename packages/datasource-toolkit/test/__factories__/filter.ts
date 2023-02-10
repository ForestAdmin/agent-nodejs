import { Factory } from 'fishery';

import Filter from '../../src/interfaces/query/filter';

export default Factory.define<Filter>(() => new Filter({}));
