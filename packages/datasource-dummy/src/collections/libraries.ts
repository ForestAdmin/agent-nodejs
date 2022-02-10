import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import BaseDummyCollection from './base';

export default class LibrariesCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    name: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
    },
    books: {
      type: FieldTypes.ManyToMany,
      otherField: 'libraryId',
      foreignKey: 'bookId',
      throughCollection: 'librariesBooks',
      foreignCollection: 'books',
      originRelation: 'library',
      targetRelation: 'book',
    },
  };

  private static records: RecordData[] = [
    {
      id: 1,
      name: 'Mollat',
    },
    {
      id: 2,
      name: 'Cultura',
    },
    {
      id: 3,
      name: 'Amazon',
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'libraries', LibrariesCollection.schema, LibrariesCollection.records);
  }
}
