import type { Collection, CollectionSchema } from '@forestadmin/datasource-toolkit';
import type { ForestServerSegment } from '@forestadmin/forestadmin-client';

export default class SchemaGeneratorSegments {
  static buildSchema(
    collection: Collection,
    name: CollectionSchema['segments'][number],
  ): ForestServerSegment {
    return { id: `${collection.name}.${name}`, name };
  }
}
