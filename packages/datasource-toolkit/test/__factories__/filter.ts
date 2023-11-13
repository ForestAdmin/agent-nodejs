import { Factory } from 'fishery';

import { ConditionTreeLeaf } from '../../src';
import FilterPaginated from '../../src/interfaces/query/filter/paginated';

export class FilterFactory extends Factory<FilterPaginated> {
  idPresent(): FilterPaginated {
    return this.build({
      conditionTree: new ConditionTreeLeaf('id', 'Present'),
    });
  }
}

export default FilterFactory.define(() => new FilterPaginated({}));
