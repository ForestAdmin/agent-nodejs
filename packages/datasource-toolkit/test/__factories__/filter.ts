import { Factory } from 'fishery';

import FilterPaginated from '../../src/interfaces/query/filter/paginated';

export default Factory.define<FilterPaginated>(() => new FilterPaginated({}));
