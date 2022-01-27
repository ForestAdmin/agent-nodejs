import RecordUtils from '../../utils/record';
import { RecordData } from '../record';
import Projection from './projection';

export type OrderBy = { field: string; ascending: boolean };

export default class Sort extends Array<OrderBy> {
  get projection(): Projection {
    return new Projection(...this.map(s => s.field));
  }

  replaceFields(callback: (orderBy: OrderBy) => Sort | OrderBy[] | OrderBy): Sort {
    return this.map(ob => callback(ob)).reduce<Sort>((memo, cbResult) => {
      return Array.isArray(cbResult) ? new Sort(...memo, ...cbResult) : new Sort(...memo, cbResult);
    }, new Sort());
  }

  nest(prefix: string): Sort {
    return this.map(ob => ({ field: `${prefix}:${ob.field}`, ascending: ob.ascending })) as Sort;
  }

  unnest(): Sort {
    const [prefix] = this[0].field.split(':');

    if (!this.every(ob => ob.field.startsWith(prefix))) {
      throw new Error('Cannot unnest sort.');
    }

    return this.map(({ field, ascending }) => ({
      field: field.substring(prefix.length + 1),
      ascending,
    })) as Sort;
  }

  apply(records: RecordData[]): RecordData[] {
    const { length } = this;

    return records.sort((a, b) => {
      for (let i = 0; i < length; i += 1) {
        const { field, ascending } = this[i];
        const valueOnA = RecordUtils.getFieldValue(a, field);
        const valueOnB = RecordUtils.getFieldValue(b, field);

        if (valueOnA < valueOnB) return ascending ? -1 : 1;
        if (valueOnA > valueOnB) return ascending ? 1 : -1;
      }

      return 0;
    });
  }
}
