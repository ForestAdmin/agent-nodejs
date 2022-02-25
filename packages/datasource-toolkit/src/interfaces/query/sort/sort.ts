import { RecordData } from '../../record';
import Projection from '../projection';
import RecordUtils from '../../../utils/record';

export type SortClause = { field: string; ascending: boolean };

export default class Sort extends Array<SortClause> {
  get projection(): Projection {
    return new Projection(...this.map(s => s.field));
  }

  replaceClauses(callback: (clause: SortClause) => Sort | SortClause[] | SortClause): Sort {
    return this.map(ob => callback(ob)).reduce<Sort>((memo, cbResult) => {
      return Array.isArray(cbResult) ? new Sort(...memo, ...cbResult) : new Sort(...memo, cbResult);
    }, new Sort());
  }

  nest(prefix: string): Sort {
    return prefix && prefix.length
      ? (this.map(ob => ({ field: `${prefix}:${ob.field}`, ascending: ob.ascending })) as Sort)
      : this;
  }

  inverse(): Sort {
    return this.map(({ field, ascending }) => ({ field, ascending: !ascending })) as Sort;
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
