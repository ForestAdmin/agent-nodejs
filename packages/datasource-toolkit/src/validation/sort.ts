import { Collection } from '../interfaces/collection';
import FieldValidator from './field';

export default class SortValidator {
  static validate(collection: Collection, sort: { field: string; ascending: boolean }[]): void {
    for (const s of sort ?? []) {
      FieldValidator.validate(collection, s.field);
      if (typeof s.ascending !== 'boolean')
        throw new Error(`Invalid sort.ascending value: ${s.ascending}`);
    }
  }
}
