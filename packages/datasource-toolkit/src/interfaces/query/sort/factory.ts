import { Collection } from '../../collection';
import SchemaUtils from '../../../utils/schema';
import Sort from '../sort';

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
