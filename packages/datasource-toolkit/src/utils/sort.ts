import { Collection } from '../interfaces/collection';
import FieldUtils from '../validation/field';

export default class SortUtils {
  static validate(collection: Collection, sort: { field: string; ascending: boolean }[]): void {
    for (const s of sort ?? []) {
      FieldUtils.validate(collection, s.field);
      if (typeof s.ascending !== 'boolean')
        throw new Error(`Invalid sort.ascending value: ${s.ascending}`);
    }
  }
}
