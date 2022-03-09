import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import BaseDummyCollection from './base';

export default class LibrariesBooksCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    bookId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    libraryId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
  };

  protected override records: RecordData[] = [
    { bookId: 1, libraryId: 1 },
    { bookId: 2, libraryId: 1 },
    { bookId: 3, libraryId: 2 },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'librariesBooks', LibrariesBooksCollection.schema);
  }
}
