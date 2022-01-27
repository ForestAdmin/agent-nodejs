import { Factory } from 'fishery';
import FilterPaginated from '../../dist/interfaces/query/filter/paginated';

export default Factory.define<FilterPaginated>(() => new FilterPaginated({}));
