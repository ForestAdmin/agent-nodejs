import Sort from '.';
import SchemaUtils from '../../../utils/schema';
import { Collection } from '../../collection';

export default class SortFactory {
  static byPrimaryKeys(collection: Collection): Sort {
    return new Sort(
      ...SchemaUtils.getPrimaryKeys(collection.schema).map(pk => ({
        field: pk,
        ascending: true,
      })),
    );
  }
}
