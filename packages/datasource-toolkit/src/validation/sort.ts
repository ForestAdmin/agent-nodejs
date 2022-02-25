import { Collection } from '../interfaces/collection';
import { SortClause } from '../interfaces/query/sort/sort';
import FieldValidator from './field';
import ValidationError from '../errors';

export default class SortValidator {
  static validate(collection: Collection, sort: SortClause[]): void {
    for (const s of sort ?? []) {
      FieldValidator.validate(collection, s.field);
      if (typeof s.ascending !== 'boolean')
        throw new ValidationError(`Invalid sort.ascending value: ${s.ascending}`);
    }
  }
}
