import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import BaseDummyCollection from './base';

export default class BooksCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    title: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
      defaultValue: 'Le rouge et le noir',
    },
    publication: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Date,
    },
    authorId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      defaultValue: 34,
    },
  };

  protected override records: RecordData[] = [
    {
      id: 1,
      title: 'Beat the dealer',
      publication: new Date().toISOString(),
      authorId: 1,
    },
    {
      id: 2,
      title: 'Foundation',
      publication: new Date().toISOString(),
      authorId: 2,
    },
    {
      id: 3,
      title: 'Gomorrah',
      publication: new Date().toISOString(),
      authorId: 3,
    },
    {
      id: 4,
      title: 'Misery',
      authorId: 4,
      publication: new Date().toISOString(),
    },
    {
      id: 5,
      title: 'Chistine',
      authorId: 4,
      publication: new Date().toISOString(),
    },
    {
      id: 6,
      title: 'Running Man',
      authorId: 4,
      publication: new Date().toISOString(),
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'books', BooksCollection.schema);
  }
}
