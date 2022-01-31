import { Collection } from '../interfaces/collection';
import FieldValidator from './field';
import { SortClause } from '../interfaces/query/sort';

export default class SortValidator {
  static validate(collection: Collection, sort: SortClause[]): void {
    for (const s of sort ?? []) {
      FieldValidator.validate(collection, s.field);
      if (typeof s.ascending !== 'boolean')
        throw new Error(`Invalid sort.ascending value: ${s.ascending}`);
    }
  }
}
