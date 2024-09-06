import Sort from '.';
import SchemaUtils from '../../../utils/schema';
import { Collection } from '../../collection';
import { ColumnSchema } from '../../schema';

export default class SortFactory {
  static byPrimaryKeys(collection: Collection): Sort {
    return new Sort(
      ...SchemaUtils.getPrimaryKeys(collection.schema)
        .map(pk =>
          (collection.schema.fields[pk] as ColumnSchema).isSortable
            ? {
                field: pk,
                ascending: true,
              }
            : null,
        )
        .filter(Boolean),
    );
  }
}
