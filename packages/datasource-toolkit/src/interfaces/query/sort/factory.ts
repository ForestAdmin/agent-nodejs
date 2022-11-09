import Sort from '.';
import Collection from '../../../collection';

export default class SortFactory {
  static byPrimaryKeys(collection: Collection): Sort {
    return new Sort(
      ...collection.schema.primaryKeys.map(pk => ({
        field: pk,
        ascending: true,
      })),
    );
  }
}
