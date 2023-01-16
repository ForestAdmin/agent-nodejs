import FieldValidator from './field';
import { ValidationError } from '../errors';
import { Collection } from '../interfaces/collection';
import { PlainSortClause } from '../interfaces/query/sort';

export default class SortValidator {
  static validate(collection: Collection, sort: PlainSortClause[]): void {
    for (const s of sort ?? []) {
      FieldValidator.validate(collection, s.field);
      if (typeof s.ascending !== 'boolean')
        throw new ValidationError(`Invalid sort.ascending value: ${s.ascending}`);
    }
  }
}
